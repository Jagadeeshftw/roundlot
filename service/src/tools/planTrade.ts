import { encodeFunctionData, erc20Abi, formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { z } from "zod";
import { mainnet, swapRouterAbi, UNISWAP, wrapperAbi } from "../data/chain.js";
import { quoteExactIn } from "../data/pool.js";
import { getTokenState, toFloat18 } from "../data/xstock.js";
import { DATA_NETWORK } from "../networks.js";
import { requireSymbol, sizeFields, ToolError } from "./common.js";
import { route } from "./quote.js";

export const planTradeInput = z.object({
  ...sizeFields,
  maxSlippageBps: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Worst acceptable fill vs the quote, in basis points; sets amountOutMinimum / amountInMaximum"),
  account: z
    .string()
    .refine((v) => isAddress(v), "must be a 0x address")
    .describe("Address that will sign the transactions and receive the output"),
  tokenForm: z
    .enum(["raw", "wrapped"])
    .default("raw")
    .describe("raw = the account holds / wants the xStock token itself (adds wrap/unwrap steps); wrapped = the ERC-4626 wrapper token"),
  deadlineSeconds: z.coerce.number().int().min(60).max(3600).default(600).describe("Seconds until the swap reverts (60–3600)"),
});
export type PlanTradeInput = z.infer<typeof planTradeInput>;

type Hex = `0x${string}`;
interface Step {
  kind: "approve" | "wrap" | "swap" | "unwrap";
  to: Hex;
  data: Hex;
  value: "0";
  description: string;
}

const BPS = 10_000n;
const mulBps = (v: bigint, bps: bigint) => (v * bps) / BPS;
const ceilMulBps = (v: bigint, bps: bigint) => (v * bps + BPS - 1n) / BPS;

export async function planTrade(input: PlanTradeInput) {
  const x = requireSymbol(input.symbol);
  const account = getAddress(input.account);
  const slip = BigInt(input.maxSlippageBps);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + input.deadlineSeconds);
  const stable = x.pool.quote;
  const wrapped = x.wrapped.address;
  const raw = input.tokenForm === "raw";

  const token = await getTokenState(x);
  if (token.pendingMultiplier && token.pendingMultiplier.activatesAt <= Number(deadline) + 60) {
    throw new ToolError(
      "multiplier_change_pending",
      `${x.raw.symbol} has a multiplier change at ${new Date(token.pendingMultiplier.activatesAt * 1000).toISOString()}, inside this trade's deadline window. Retry after it activates.`,
    );
  }

  let r = await route(input);
  // Selling a raw amount: the swap must spend exactly what the deposit mints,
  // so re-quote with the wrapper's own previewDeposit rather than our ratio.
  let rawIn: bigint | undefined;
  if (r.side === "sell" && r.exact === "input" && raw) {
    rawIn = parseUnits(input.size, 18);
    const minted = await mainnet.readContract({ address: wrapped, abi: wrapperAbi, functionName: "previewDeposit", args: [rawIn] });
    if (minted !== r.wrappedAmount) {
      const swap = await quoteExactIn(wrapped, stable.address, x.pool.fee, minted);
      if (swap.partial) throw new ToolError("insufficient_liquidity", "Pool cannot fill this size.");
      r = { ...r, swap, wrappedAmount: minted, stableAmount: swap.amountOut };
    }
  }

  const steps: Step[] = [];
  const approvals: { token: Hex; spender: Hex; amount: bigint; label: string }[] = [];
  const router = UNISWAP.swapRouter02 as Hex;
  const swapStep = (inner: Hex, description: string): Step => ({
    kind: "swap",
    to: router,
    data: encodeFunctionData({ abi: swapRouterAbi, functionName: "multicall", args: [deadline, [inner]] }),
    value: "0",
    description,
  });

  let limits: Record<string, string>;
  let expected: Record<string, string>;

  if (r.side === "buy") {
    let wrappedReceivedMin: bigint;
    if (r.exact === "input") {
      const minOut = mulBps(r.wrappedAmount, BPS - slip);
      wrappedReceivedMin = minOut;
      approvals.push({ token: stable.address, spender: router, amount: r.stableAmount, label: stable.symbol });
      steps.push(
        swapStep(
          encodeFunctionData({
            abi: swapRouterAbi,
            functionName: "exactInputSingle",
            args: [{ tokenIn: stable.address, tokenOut: wrapped, fee: x.pool.fee, recipient: account, amountIn: r.stableAmount, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
          }),
          `Swap ${formatUnits(r.stableAmount, stable.decimals)} ${stable.symbol} for at least ${formatUnits(minOut, 18)} ${x.wrapped.symbol}`,
        ),
      );
      limits = { amountIn: formatUnits(r.stableAmount, stable.decimals), amountOutMinimum: formatUnits(minOut, 18) };
    } else {
      const maxIn = ceilMulBps(r.stableAmount, BPS + slip);
      wrappedReceivedMin = r.wrappedAmount;
      approvals.push({ token: stable.address, spender: router, amount: maxIn, label: stable.symbol });
      steps.push(
        swapStep(
          encodeFunctionData({
            abi: swapRouterAbi,
            functionName: "exactOutputSingle",
            args: [{ tokenIn: stable.address, tokenOut: wrapped, fee: x.pool.fee, recipient: account, amountOut: r.wrappedAmount, amountInMaximum: maxIn, sqrtPriceLimitX96: 0n }],
          }),
          `Swap at most ${formatUnits(maxIn, stable.decimals)} ${stable.symbol} for exactly ${formatUnits(r.wrappedAmount, 18)} ${x.wrapped.symbol}`,
        ),
      );
      limits = { amountOut: formatUnits(r.wrappedAmount, 18), amountInMaximum: formatUnits(maxIn, stable.decimals) };
    }
    expected = { pay: `${formatUnits(r.stableAmount, stable.decimals)} ${stable.symbol}`, receive: `${formatUnits(r.wrappedAmount, 18)} ${x.wrapped.symbol}` };
    if (raw) {
      const rawOut = await mainnet.readContract({ address: wrapped, abi: wrapperAbi, functionName: "previewRedeem", args: [wrappedReceivedMin] });
      steps.push({
        kind: "unwrap",
        to: wrapped,
        data: encodeFunctionData({ abi: wrapperAbi, functionName: "redeem", args: [wrappedReceivedMin, account, account] }),
        value: "0",
        description: `Unwrap ${formatUnits(wrappedReceivedMin, 18)} ${x.wrapped.symbol} into ${formatUnits(rawOut, 18)} ${x.raw.symbol}`,
      });
      expected.receive = `${formatUnits(rawOut, 18)} ${x.raw.symbol}` + (r.exact === "input" ? ` (any fill above the slippage floor stays as ${x.wrapped.symbol})` : "");
    }
  } else {
    let wrappedToSpend: bigint;
    if (r.exact === "input") {
      wrappedToSpend = r.wrappedAmount;
      const minOut = mulBps(r.stableAmount, BPS - slip);
      steps.push(
        swapStep(
          encodeFunctionData({
            abi: swapRouterAbi,
            functionName: "exactInputSingle",
            args: [{ tokenIn: wrapped, tokenOut: stable.address, fee: x.pool.fee, recipient: account, amountIn: wrappedToSpend, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
          }),
          `Swap ${formatUnits(wrappedToSpend, 18)} ${x.wrapped.symbol} for at least ${formatUnits(minOut, stable.decimals)} ${stable.symbol}`,
        ),
      );
      limits = { amountIn: formatUnits(wrappedToSpend, 18), amountOutMinimum: formatUnits(minOut, stable.decimals) };
    } else {
      wrappedToSpend = ceilMulBps(r.wrappedAmount, BPS + slip);
      steps.push(
        swapStep(
          encodeFunctionData({
            abi: swapRouterAbi,
            functionName: "exactOutputSingle",
            args: [{ tokenIn: wrapped, tokenOut: stable.address, fee: x.pool.fee, recipient: account, amountOut: r.stableAmount, amountInMaximum: wrappedToSpend, sqrtPriceLimitX96: 0n }],
          }),
          `Swap at most ${formatUnits(wrappedToSpend, 18)} ${x.wrapped.symbol} for exactly ${formatUnits(r.stableAmount, stable.decimals)} ${stable.symbol}`,
        ),
      );
      limits = { amountOut: formatUnits(r.stableAmount, stable.decimals), amountInMaximum: formatUnits(wrappedToSpend, 18) };
    }
    approvals.push({ token: wrapped, spender: router, amount: wrappedToSpend, label: x.wrapped.symbol });
    expected = { pay: `${formatUnits(r.wrappedAmount, 18)} ${x.wrapped.symbol}`, receive: `${formatUnits(r.stableAmount, stable.decimals)} ${stable.symbol}` };

    if (raw) {
      const assets =
        rawIn ?? (await mainnet.readContract({ address: wrapped, abi: wrapperAbi, functionName: "previewMint", args: [wrappedToSpend] }));
      approvals.unshift({ token: x.raw.address, spender: wrapped, amount: assets, label: x.raw.symbol });
      steps.unshift({
        kind: "wrap",
        to: wrapped,
        data: encodeFunctionData({ abi: wrapperAbi, functionName: "deposit", args: [assets, account] }),
        value: "0",
        description: `Wrap ${formatUnits(assets, 18)} ${x.raw.symbol} into ${x.wrapped.symbol}`,
      });
      expected.pay = `${formatUnits(assets, 18)} ${x.raw.symbol}` + (r.exact === "output" ? ` (unused ${x.wrapped.symbol} stays in the account)` : "");
    }
  }

  // Only include approvals the account doesn't already have, and flag balances
  // that are too low (the plan is still returned so it can be funded first).
  const warnings: string[] = [];
  const [allowances, balances] = await Promise.all([
    Promise.all(approvals.map((a) => mainnet.readContract({ address: a.token, abi: erc20Abi, functionName: "allowance", args: [account, a.spender] }))),
    Promise.all(approvals.map((a) => mainnet.readContract({ address: a.token, abi: erc20Abi, functionName: "balanceOf", args: [account] }))),
  ]);
  const approveSteps: Step[] = [];
  approvals.forEach((a, i) => {
    if (allowances[i]! < a.amount) {
      approveSteps.push({
        kind: "approve",
        to: a.token,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [a.spender, a.amount] }),
        value: "0",
        description: `Approve ${a.spender === router ? "SwapRouter02" : x.wrapped.symbol} to spend ${a.label}`,
      });
    }
  });
  // The first spend comes from the account's own balance; later ones come from earlier steps.
  const first = approvals[0]!;
  if (balances[0]! < first.amount) warnings.push(`Account holds less ${first.label} than this plan spends.`);

  // Interleave: each approve goes right before the step that spends it.
  const ordered: Step[] = [];
  for (const step of steps) {
    const spender = step.kind === "wrap" ? wrapped : step.kind === "swap" ? router : undefined;
    const tokenSpent = step.kind === "wrap" ? x.raw.address : step.kind === "swap" ? (r.side === "buy" ? stable.address : wrapped) : undefined;
    const ap = approveSteps.find((s) => s.to.toLowerCase() === tokenSpent?.toLowerCase() && spender);
    if (ap) ordered.push(ap);
    ordered.push(step);
  }

  return {
    chainId: DATA_NETWORK.chainId,
    network: DATA_NETWORK.caip2,
    account,
    symbol: x.symbol,
    side: r.side,
    tokenForm: input.tokenForm,
    steps: ordered.map((s, i) => ({ index: i + 1, ...s })),
    expected,
    limits: {
      ...limits,
      maxSlippageBps: input.maxSlippageBps,
      deadline: new Date(Number(deadline) * 1000).toISOString(),
    } as Record<string, string | number>,
    rate: { sharesPerWrappedToken: toFloat18(r.assetsPerWrapped) },
    warnings,
    notes: [
      "Unsigned transactions for X Layer mainnet (chain 196). Sign and send them in order from `account`; Roundlot never holds keys or funds.",
      "The swap is wrapped in SwapRouter02.multicall(deadline, ...) so it reverts after the deadline.",
    ],
    data: { blockNumber: r.blockNumber.toString(), plannedAt: new Date().toISOString() },
  };
}
