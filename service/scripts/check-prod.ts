// Production check before recording or submitting: every web route, the free
// API, every paid tool over REST and over both MCP carriers, Try-it, and the
// activity feed. Spends about $0.06 of testnet USD₮0 from the demo wallet and
// one of the three hourly Try-it tries.
// Usage: npx tsx --env-file=../.env scripts/check-prod.ts [--no-paid] [--no-try]
//   --no-paid  skip everything that spends testnet USD₮0
//   --no-try   pay the REST and MCP checks but leave the Try-it quota alone
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from "@okxweb3/app-x402-core/http";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "../src/mcp/paymentGate.js";
import { paymentNetwork } from "../src/networks.js";
import { createBuyer } from "../src/x402/buyer.js";

const api = process.env.API_URL ?? "https://api.roundlot.0xo.in";
const web = process.env.WEB_URL ?? "https://roundlot.0xo.in";
const paid = !process.argv.includes("--no-paid");
const tryIt = paid && !process.argv.includes("--no-try");
const buyer = createBuyer(process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, paymentNetwork("eip155:1952"));

const tty = process.stdout.isTTY;
const ok = tty ? "\x1b[32mPASS\x1b[0m" : "PASS";
const bad = tty ? "\x1b[31mFAIL\x1b[0m" : "FAIL";
const results: boolean[] = [];
const txs: string[] = [];

async function check(name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push(true);
    console.log(`${ok}  ${name.padEnd(44)} ${String(Date.now() - t0).padStart(5)} ms  ${note ?? ""}`);
  } catch (err) {
    results.push(false);
    console.log(`${bad}  ${name.padEnd(44)} ${String(Date.now() - t0).padStart(5)} ms  ${err instanceof Error ? err.message : err}`);
  }
}
function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const settledNote = (r?: SettleResponse | null) => {
  expect(r?.success, `not settled: ${JSON.stringify(r)}`);
  txs.push(r.transaction);
  return `tx ${r.transaction.slice(0, 10)}…`;
};

console.log(`web ${web}\napi ${api}\n`);

// Web
for (const path of ["/", "/docs", "/docs/quickstart", "/docs/paying-rest", "/docs/paying-mcp", "/docs/networks", "/docs/catalog", "/docs/session", "/docs/quote", "/docs/plan-trade", "/docs/errors"]) {
  await check(`web ${path}`, async () => {
    const r = await fetch(web + path);
    expect(r.status === 200, `HTTP ${r.status}`);
  });
}
await check("web shows Try it section", async () => {
  const html = await (await fetch(web + "/")).text();
  expect(html.includes("Watch one paid call happen"), "Try it section not rendered (NEXT_PUBLIC_TRY_IT?)");
});

// Free API
let paymentsReady = false;
await check("api /health?deep=1", async () => {
  const h = await (await fetch(`${api}/health?deep=1`)).json();
  expect(h.ok && h.upstreams?.okx?.ok && h.upstreams?.mainnetRpc?.ok, JSON.stringify(h.upstreams));
  paymentsReady = h.payments?.state === "ready";
  expect(paymentsReady, `payments ${JSON.stringify(h.payments)}`);
  return `facilitator ${h.payments.facilitator}`;
});
await check("api GET /v1/catalog", async () => {
  const c = await (await fetch(`${api}/v1/catalog`)).json();
  expect(c.symbols?.length === 3 && c.tools?.length === 4, "unexpected catalog");
});
await check("api POST /v1/catalog {symbol}", async () => {
  const r = await fetch(`${api}/v1/catalog`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"symbol":"NVDA"}' });
  const c = await r.json();
  expect(c.symbols?.length === 1 && c.symbols[0].symbol === "NVDA", "filter failed");
});
await check("api bad input → 400, no payment asked", async () => {
  const r = await fetch(`${api}/v1/quote?symbol=NVDA&side=hold&size=1`);
  expect(r.status === 400, `HTTP ${r.status}`);
});

// Paid REST
const rest: [string, string][] = [
  ["session", "/v1/session?symbol=NVDA"],
  ["quote", "/v1/quote?symbol=SPY&side=buy&size=500"],
  ["plan_trade", "/v1/plan-trade?symbol=NVDA&side=buy&size=250&account=0x5075ff68a0efb54db13423ad924bd680327d305e"],
];
for (const [tool, path] of rest) {
  await check(`REST ${tool} unpaid → 402`, async () => {
    const r = await fetch(api + path);
    expect(r.status === 402, `HTTP ${r.status}`);
    const pr = decodePaymentRequiredHeader(r.headers.get("PAYMENT-REQUIRED")!);
    expect(pr.accepts[0]?.network === "eip155:1952", "wrong network");
    return `${Number(pr.accepts[0]!.amount) / 1e6} USD₮0`;
  });
  if (paid) {
    await check(`REST ${tool} paid → 200 + receipt`, async () => {
      const { response, receipt } = await buyer.fetchPaid(api + path);
      expect(response.status === 200, `HTTP ${response.status}`);
      return settledNote(receipt);
    });
  }
}

// MCP, in-band carrier (official SDK client)
const mcp = new Client({ name: "roundlot-check", version: "0.0.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${api}/mcp`)));
await check("MCP tools/list", async () => {
  const { tools } = await mcp.listTools();
  expect(tools.map((t) => t.name).sort().join() === "catalog,plan_trade,quote,session", "tool list");
});
await check("MCP catalog (free)", async () => {
  const r = (await mcp.callTool({ name: "catalog", arguments: {} })) as CallToolResult;
  expect(!r.isError, "catalog errored");
});
await check("MCP in-band: unpaid → PaymentRequired", async () => {
  const r = (await mcp.callTool({ name: "session", arguments: { symbol: "TSLA" } })) as CallToolResult;
  expect(r.isError && (r.structuredContent as PaymentRequired)?.accepts, "no PaymentRequired");
});
if (paid) {
  await check("MCP in-band: paid session → receipt", async () => {
    const args = { symbol: "TSLA" };
    const first = (await mcp.callTool({ name: "session", arguments: args })) as CallToolResult;
    const payload = await buyer.createPayment(first.structuredContent as unknown as PaymentRequired);
    const r = (await mcp.callTool({ name: "session", arguments: args, _meta: { [MCP_PAYMENT_META_KEY]: payload } })) as CallToolResult;
    expect(!r.isError, "tool errored");
    return settledNote(r._meta?.[MCP_PAYMENT_RESPONSE_META_KEY] as SettleResponse);
  });
}
await mcp.close();

// MCP, HTTP carrier (onchainos-style: no MCP-Protocol-Version header)
const rpc = (id: number, headers: Record<string, string> = {}) =>
  fetch(`${api}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "quote", arguments: { symbol: "NVDA", side: "buy", size: "250" } } }),
  });
let challenge: PaymentRequired | undefined;
await check("MCP HTTP: unpaid → 402 + PAYMENT-REQUIRED", async () => {
  const r = await rpc(3);
  expect(r.status === 402, `HTTP ${r.status}`);
  challenge = decodePaymentRequiredHeader(r.headers.get("PAYMENT-REQUIRED")!);
});
if (paid) {
  await check("MCP HTTP: PAYMENT-SIGNATURE → PAYMENT-RESPONSE", async () => {
    expect(challenge, "no challenge");
    const payload = await buyer.createPayment(challenge);
    const r = await rpc(4, { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) });
    expect(r.status === 200, `HTTP ${r.status}`);
    return settledNote(decodePaymentResponseHeader(r.headers.get("PAYMENT-RESPONSE")!));
  });

}
if (tryIt) {
  // Try-it (uses one of the visitor's three hourly tries)
  await check("Try-it POST /v1/try", async () => {
    const r = await fetch(`${api}/v1/try`, { method: "POST", headers: { "content-type": "application/json", origin: web }, body: '{"symbol":"NVDA"}' });
    const body = await r.json();
    expect(r.status === 200, `HTTP ${r.status} ${JSON.stringify(body)}`);
    expect(r.headers.get("access-control-allow-origin") === web, "CORS header missing");
    return settledNote(body.receipt);
  });
}

await check("api /v1/activity populated", async () => {
  const a = await (await fetch(`${api}/v1/activity`)).json();
  expect(a.settlements?.length > 0, "no settlements recorded");
  const recorded = new Set(a.settlements.map((s: { transaction: string }) => s.transaction));
  const missing = txs.filter((t) => !recorded.has(t));
  expect(missing.length === 0, `${missing.length} of this run's settlements missing`);
  return `${a.settlements.length} settlements`;
});

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? ok : bad}  ${results.length - failed}/${results.length} checks passed`);
if (txs.length) console.log(`settlements this run:\n${txs.map((t) => `  https://web3.okx.com/explorer/x-layer-testnet/tx/${t}`).join("\n")}`);
console.log(`demo wallet: ${(Number(await buyer.balance()) / 1e6).toFixed(3)} USD₮0`);
process.exit(failed ? 1 : 0);
