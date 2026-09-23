// Executes plan_trade output on a local anvil fork of X Layer mainnet and
// checks balances. Run with: FORK=1 npx vitest run test/planTrade.fork.test.ts
import { spawn, type ChildProcess } from "node:child_process";
import { createTestClient, createWalletClient, erc20Abi, http, parseEther, parseUnits, publicActions, type Hex } from "viem";
import { xLayer } from "viem/chains";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
const ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const; // anvil account 0 (unlocked)
const USDG = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8" as const;
const USDC = "0xb6ceceab302e2e4948951ee7843fc24e92933061" as const;
// Pools hold plenty of stablecoin; impersonating them is the simplest donor.
const USDG_DONOR = "0x07c40850D14064D20eB0AfDEf9574675392f2c11" as const; // wSPYx/USDG

const chain = { ...xLayer, rpcUrls: { default: { http: [RPC] } } };
const test = createTestClient({ chain, mode: "anvil", transport: http(RPC) }).extend(publicActions);
const wallet = createWalletClient({ chain, transport: http(RPC) });

let anvil: ChildProcess;
let planTrade: typeof import("../src/tools/planTrade.js").planTrade;
let XSTOCKS: typeof import("../src/registry.js").XSTOCKS;

const balance = (token: Hex, who: Hex = ACCOUNT) =>
  test.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });

async function fund(token: Hex, donor: Hex, amount: bigint) {
  await test.impersonateAccount({ address: donor });
  await test.setBalance({ address: donor, value: parseEther("1") });
  const hash = await wallet.writeContract({ account: donor, address: token, abi: erc20Abi, functionName: "transfer", args: [ACCOUNT, amount], chain });
  await test.waitForTransactionReceipt({ hash });
  await test.stopImpersonatingAccount({ address: donor });
}

async function execute(plan: Awaited<ReturnType<typeof planTrade>>) {
  for (const step of plan.steps) {
    const hash = await wallet.sendTransaction({ account: ACCOUNT, to: step.to, data: step.data, chain });
    const receipt = await test.waitForTransactionReceipt({ hash });
    expect(receipt.status, `step ${step.index} ${step.kind}: ${step.description}`).toBe("success");
  }
}

describe.skipIf(!process.env.FORK)("plan_trade on a mainnet fork", () => {
  beforeAll(async () => {
    anvil = spawn("anvil", ["--fork-url", process.env.FORK_URL ?? "https://xlayerrpc.okx.com", "--port", String(PORT), "--silent"], { stdio: "ignore" });
    for (let i = 0; i < 60; i++) {
      try {
        await test.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    process.env.DATA_RPC_URLS = RPC;
    ({ planTrade } = await import("../src/tools/planTrade.js"));
    ({ XSTOCKS } = await import("../src/registry.js"));
    const { getPoolState } = await import("../src/data/pool.js");
    const usdcDonor = (await getPoolState(XSTOCKS.TSLA!)).address; // wTSLAx/USDC pool
    await fund(USDG, USDG_DONOR, parseUnits("5000", 6));
    await fund(USDC, usdcDonor, parseUnits("2000", 6));
  }, 60_000);

  afterAll(() => {
    anvil?.kill();
  });

  it("buys NVDA for USD and delivers raw NVDAx, then sells 1 share back", async () => {
    const nvda = XSTOCKS.NVDA!;
    const rawBefore = await balance(nvda.raw.address);
    const buy = await planTrade({ symbol: "NVDA", side: "buy", size: "500", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "raw", deadlineSeconds: 600 });
    expect(buy.steps.map((s) => s.kind)).toEqual(["approve", "swap", "unwrap"]);
    await execute(buy);
    const gotRaw = (await balance(nvda.raw.address)) - rawBefore;
    expect(gotRaw).toBeGreaterThan(parseUnits("2", 18)); // ~$500 / ~$229

    const usdgBefore = await balance(USDG);
    const sell = await planTrade({ symbol: "NVDA", side: "sell", size: "1", sizeUnit: "shares", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "raw", deadlineSeconds: 600 });
    expect(sell.steps.map((s) => s.kind)).toEqual(["approve", "wrap", "approve", "swap"]);
    await execute(sell);
    expect((await balance(nvda.raw.address)) - rawBefore).toBe(gotRaw - parseUnits("1", 18));
    const usdgGot = Number((await balance(USDG)) - usdgBefore) / 1e6;
    expect(usdgGot).toBeGreaterThan(200);
    expect(usdgGot).toBeLessThan(260);
  }, 120_000);

  it("buys exactly 1 SPY share as wrapped, then sells for exactly 300 USDG", async () => {
    const spy = XSTOCKS.SPY!;
    const wBefore = await balance(spy.wrapped.address);
    const buy = await planTrade({ symbol: "SPY", side: "buy", size: "1", sizeUnit: "shares", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "wrapped", deadlineSeconds: 600 });
    await execute(buy);
    const got = (await balance(spy.wrapped.address)) - wBefore;
    expect(got).toBe(parseUnits(String(buy.limits.amountOut), 18));

    const usdgBefore = await balance(USDG);
    const sell = await planTrade({ symbol: "SPY", side: "sell", size: "300", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "wrapped", deadlineSeconds: 600 });
    await execute(sell);
    expect((await balance(USDG)) - usdgBefore).toBe(parseUnits("300", 6));
  }, 120_000);

  it("buys TSLA as raw, then sells raw for exactly 100 USDC (wrap via previewMint)", async () => {
    const tsla = XSTOCKS.TSLA!;
    await execute(await planTrade({ symbol: "TSLA", side: "buy", size: "400", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "raw", deadlineSeconds: 600 }));
    expect(await balance(tsla.raw.address)).toBeGreaterThan(parseUnits("1", 18));

    const usdcBefore = await balance(USDC);
    const sell = await planTrade({ symbol: "TSLA", side: "sell", size: "100", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "raw", deadlineSeconds: 600 });
    expect(sell.steps[0]!.kind).toBe("approve");
    await execute(sell);
    expect((await balance(USDC)) - usdcBefore).toBe(parseUnits("100", 6));
  }, 120_000);

  it("skips approvals the account already granted", async () => {
    const plan = await planTrade({ symbol: "NVDA", side: "buy", size: "10", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "wrapped", deadlineSeconds: 600 });
    // The earlier NVDA buy approved exactly its own amount and spent it, so a fresh approve is expected here...
    expect(plan.steps[0]!.kind).toBe("approve");
    await execute(plan);
    // ...but after an unlimited approval none is needed.
    const hash = await wallet.writeContract({ account: ACCOUNT, address: USDG, abi: erc20Abi, functionName: "approve", args: ["0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca", 2n ** 255n], chain });
    await test.waitForTransactionReceipt({ hash });
    const again = await planTrade({ symbol: "NVDA", side: "buy", size: "10", sizeUnit: "usd", maxSlippageBps: 50, account: ACCOUNT, tokenForm: "wrapped", deadlineSeconds: 600 });
    expect(again.steps.map((s) => s.kind)).toEqual(["swap"]);
  }, 120_000);
});
