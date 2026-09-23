// A minimal paying agent: connects to Roundlot over MCP, reads the free
// catalog, then pays per call for session, quote and plan_trade.
// Usage: BASE_URL=https://api-production-86c9.up.railway.app npx tsx --env-file=../.env scripts/demo-agent.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "../src/mcp/paymentGate.js";
import { paymentNetwork, txUrl } from "../src/networks.js";
import { createBuyer } from "../src/x402/buyer.js";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const net = paymentNetwork(process.env.PAYMENT_NETWORK ?? "eip155:1952");
if (process.env.PAYMENT_RPC_URL) net.rpcUrl = process.env.PAYMENT_RPC_URL;
const buyer = createBuyer(process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, net);
// plan_trade builds mainnet transactions for this account; it only reads its
// balances and allowances, nothing is signed or sent.
const account = process.env.PLAN_ACCOUNT ?? buyer.address;

const usd = (v: bigint) => `$${(Number(v) / 10 ** net.asset.decimals).toFixed(3)}`;
const step = (n: number, title: string) => console.log(`\n── ${n}. ${title}`);

const mcp = new Client({ name: "roundlot-demo-agent", version: "0.1.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));

// Calls a tool; if it answers "payment required", signs the x402 payment and
// retries the same call with the payload in _meta.
async function call(name: string, args: Record<string, unknown>) {
  const first = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const required = first.isError ? (first.structuredContent as PaymentRequired | undefined) : undefined;
  if (!required?.accepts) return { result: first, receipt: undefined };
  const offer = required.accepts[0]!;
  console.log(`   402: ${name} costs ${usd(BigInt(offer.amount))} ${net.asset.symbol} on ${offer.network}; signing…`);
  const payload = await buyer.createPayment(required);
  const paid = (await mcp.callTool({ name, arguments: args, _meta: { [MCP_PAYMENT_META_KEY]: payload } })) as CallToolResult;
  return { result: paid, receipt: paid._meta?.[MCP_PAYMENT_RESPONSE_META_KEY] as SettleResponse | undefined };
}

function show(r: { result: CallToolResult; receipt?: SettleResponse }) {
  if (r.receipt?.success) console.log(`   paid: settled ${txUrl(net, r.receipt.transaction)}`);
  if (r.result.isError) console.log(`   error: ${(r.result.content[0] as { text: string }).text}`);
  return r.result.structuredContent as Record<string, any>;
}

console.log(`Roundlot demo agent\n  server  ${base}\n  wallet  ${buyer.address}  (${usd(await buyer.balance())} ${net.asset.symbol} on ${net.name})`);

step(1, "Discover tools (free)");
const { tools } = await mcp.listTools();
console.log(`   ${tools.map((t) => t.name).join(", ")}`);
const catalog = show(await call("catalog", {}));
console.log(`   data on ${catalog.networks.data.network}, payments on ${catalog.networks.payment.network} via ${catalog.networks.payment.facilitator} facilitator`);

step(2, "Is the US market open for NVDA? (session)");
const s = show(await call("session", { symbol: "NVDA" }));
if (s) console.log(`   ${s.usEquityMarket.phase} (${s.usEquityMarket.reason}); OKX pricing: ${s.okx.pricing}; tradable on-chain: ${s.onchain.tradable}`);

step(3, "Quote buying $250 of NVDA (quote)");
const q = show(await call("quote", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd" }));
if (q) {
  console.log(`   ${q.fill.pay.amount} ${q.fill.pay.token} → ${q.fill.receive.shares} shares (${q.fill.receive.token})`);
  console.log(`   avg $${q.fill.avgPricePerShare}/share, impact ${q.fill.priceImpactBps} bps, vs OKX ask ${q.reference.onchainEdgeBps ?? "n/a"} bps`);
}

step(4, "Plan the trade as unsigned transactions (plan_trade)");
const p = show(await call("plan_trade", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd", maxSlippageBps: 50, account, tokenForm: "raw" }));
if (p) {
  for (const st of p.steps) console.log(`   ${st.index}. [${st.kind}] ${st.description}`);
  for (const w of p.warnings) console.log(`   note: ${w}`);
}

await mcp.close();
console.log(`\nwallet after: ${usd(await buyer.balance())} ${net.asset.symbol}`);
