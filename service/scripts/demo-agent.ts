// A minimal paying agent: connects to Roundlot over MCP, reads the free
// catalog, then pays per call for session, quote and plan_trade.
// Usage: BASE_URL=https://api.roundlot.0xo.in npx tsx --env-file=../.env scripts/demo-agent.ts [--step]
//   --step   wait for Enter before each step (for narrating a recording)
import { createInterface } from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "../src/mcp/paymentGate.js";
import { paymentNetwork, txUrl } from "../src/networks.js";
import { createBuyer } from "../src/x402/buyer.js";

const base = process.env.BASE_URL ?? "https://api.roundlot.0xo.in";
const stepMode = process.argv.includes("--step");
const net = paymentNetwork(process.env.PAYMENT_NETWORK ?? "eip155:1952");
if (process.env.PAYMENT_RPC_URL) net.rpcUrl = process.env.PAYMENT_RPC_URL;
const buyer = createBuyer(process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, net);
// plan_trade builds mainnet transactions for this account and only reads its
// balances and allowances; nothing is signed or sent. The default is a public
// X Layer address that holds USDG, so the plan needs no funding warning.
const account = process.env.PLAN_ACCOUNT ?? "0x5075ff68a0efb54db13423ad924bd680327d305e";

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint("1");
const dim = paint("2");
const cyan = paint("36");
const green = paint("32");
const red = paint("31");

const usd = (v: bigint) => `$${(Number(v) / 10 ** net.asset.decimals).toFixed(3)}`;
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
// Explorer links are 115 columns; show a shortened one, hyperlinked (OSC 8) to
// the full URL in terminals that support it, so lines stay under 90 columns.
const link = (url: string, text: string) => (tty ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : url);
const rl = stepMode ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

async function step(n: number, title: string) {
  console.log();
  if (rl) await rl.question(dim(`   (Enter for step ${n})`));
  console.log(bold(`── ${n}. ${title}`));
}

const mcp = new Client({ name: "roundlot-demo-agent", version: "0.1.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));

// Calls a tool; if it answers "payment required", signs the x402 payment and
// retries the same call with the payload in _meta.
async function call(name: string, args: Record<string, unknown>) {
  const first = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const required = first.isError ? (first.structuredContent as PaymentRequired | undefined) : undefined;
  if (!required?.accepts) return { result: first, receipt: undefined };
  const offer = required.accepts[0]!;
  console.log(`   ${cyan("402")}  ${name} costs ${usd(BigInt(offer.amount))} ${net.asset.symbol}; signing…`);
  const payload = await buyer.createPayment(required);
  const paid = (await mcp.callTool({ name, arguments: args, _meta: { [MCP_PAYMENT_META_KEY]: payload } })) as CallToolResult;
  return { result: paid, receipt: paid._meta?.[MCP_PAYMENT_RESPONSE_META_KEY] as SettleResponse | undefined };
}

function show(r: { result: CallToolResult; receipt?: SettleResponse }) {
  if (r.receipt?.success) {
    console.log(`   ${green("paid")} settled ${short(r.receipt.transaction)} on X Layer testnet`);
    const url = txUrl(net, r.receipt.transaction);
    console.log(dim(`        ${link(url, `web3.okx.com/…/tx/${short(r.receipt.transaction)}`)}`));
  }
  if (r.result.isError) console.log(`   ${red("error")} ${(r.result.content[0] as { text: string }).text.slice(0, 80)}`);
  return r.result.structuredContent as Record<string, any>;
}

console.log(bold("Roundlot demo agent"));
console.log(`   server  ${base}`);
console.log(`   wallet  ${short(buyer.address)}  ${usd(await buyer.balance())} ${net.asset.symbol} (testnet)`);

await step(1, "Discover tools (free)");
const { tools } = await mcp.listTools();
console.log(`   ${tools.map((t) => t.name).join(", ")}`);
const catalog = show(await call("catalog", {}));
console.log(`   data ${catalog.networks.data.network} · payments ${catalog.networks.payment.network}`);

await step(2, "Is the US market open for NVDA? (session)");
const s = show(await call("session", { symbol: "NVDA" }));
if (s) {
  console.log(`   market ${s.usEquityMarket.phase} · OKX ${s.okx.pricing}`);
  console.log(`   tradable on-chain: ${s.onchain.tradable}`);
}

await step(3, "Quote buying $250 of NVDA (quote)");
const q = show(await call("quote", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd" }));
if (q) {
  console.log(`   ${q.fill.pay.amount} ${q.fill.pay.token} → ${q.fill.receive.shares} NVDA shares`);
  console.log(`   avg $${q.fill.avgPricePerShare}/share · impact ${q.fill.priceImpactBps} bps`);
  console.log(`   vs OKX ask ${q.reference.onchainEdgeBps ?? "n/a"} bps`);
}

await step(4, "Plan the trade as unsigned transactions (plan_trade)");
const p = show(await call("plan_trade", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd", maxSlippageBps: 50, account, tokenForm: "raw" }));
if (p) {
  console.log(`   for ${short(p.account)} on X Layer mainnet:`);
  for (const st of p.steps) console.log(`   ${st.index}. [${st.kind}] ${st.description.replace(/(\d+\.\d{4})\d+/g, "$1")}`);
  for (const w of p.warnings) console.log(`   ${dim(`note: ${w}`)}`);
}

await mcp.close();
rl?.close();
console.log();
console.log(bold(`wallet after: ${usd(await buyer.balance())} ${net.asset.symbol}`));
