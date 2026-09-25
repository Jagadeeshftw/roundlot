// A minimal paying agent: connects to Roundlot over MCP, reads the free
// catalog, then pays per call for session, quote and plan_trade.
// Usage: BASE_URL=https://api.roundlot.0xo.in npx tsx --env-file=../.env scripts/demo-agent.ts [--step]
//   --step   pause after each 402 challenge and after each settlement (for narrating a recording)
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

// --step pauses at the two moments worth narrating: after the 402 challenge
// (before signing) and after settlement (before the answer).
async function pause(label: string) {
  if (rl) await rl.question(dim(`   (Enter ${label})`));
}

function step(n: number, title: string) {
  console.log();
  console.log(bold(`── ${n}. ${title}`));
}

const mcp = new Client({ name: "roundlot-demo-agent", version: "0.1.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));

// Calls a tool; if it answers "payment required", shows the challenge, signs
// the x402 payment and retries the same call with the payload in _meta.
async function call(name: string, args: Record<string, unknown>) {
  const first = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const required = first.isError ? (first.structuredContent as PaymentRequired | undefined) : undefined;
  if (!required?.accepts) return show({ result: first });
  const offer = required.accepts[0]!;
  const asset = (offer.extra as { name?: string } | undefined)?.name ?? net.asset.symbol;
  console.log(`   ${cyan("402")}  payment required: ${bold(name)}`);
  console.log(`        ${usd(BigInt(offer.amount))} ${asset} · ${offer.network} · payTo ${short(offer.payTo)}`);
  await pause("to sign and pay");
  const payload = await buyer.createPayment(required);
  const paid = (await mcp.callTool({ name, arguments: args, _meta: { [MCP_PAYMENT_META_KEY]: payload } })) as CallToolResult;
  return show({ result: paid, receipt: paid._meta?.[MCP_PAYMENT_RESPONSE_META_KEY] as SettleResponse | undefined });
}

async function show(r: { result: CallToolResult; receipt?: SettleResponse }) {
  if (r.receipt?.success) {
    console.log(`   ${green("paid")} settled ${short(r.receipt.transaction)} on X Layer testnet`);
    const url = txUrl(net, r.receipt.transaction);
    console.log(dim(`        ${link(url, `web3.okx.com/…/tx/${short(r.receipt.transaction)}`)}`));
    await pause("for the answer");
  }
  if (r.result.isError) console.log(`   ${red("error")} ${(r.result.content[0] as { text: string }).text.slice(0, 70)}`);
  return r.result.structuredContent as Record<string, any>;
}

console.log(bold("Roundlot demo agent"));
console.log(`   server  ${base}`);
console.log(`   wallet  ${short(buyer.address)}  ${usd(await buyer.balance())} ${net.asset.symbol} (testnet)`);

step(1, "Discover tools (free)");
const { tools } = await mcp.listTools();
console.log(`   ${tools.map((t) => t.name).join(", ")}`);
const catalog = await call("catalog", {});
console.log(`   data ${catalog.networks.data.network} · payments ${catalog.networks.payment.network}`);

step(2, "Is the US market open for NVDA? (session)");
const s = await call("session", { symbol: "NVDA" });
if (s) console.log(`   market ${bold(s.usEquityMarket.phase)} · tradable on-chain: ${s.onchain.tradable}`);

step(3, "Quote buying $250 of NVDA (quote)");
const q = await call("quote", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd" });
if (q) {
  console.log(`   ${Number(q.fill.receive.shares).toFixed(4)} shares · avg $${Number(q.fill.avgPricePerShare).toFixed(2)}/share`);
  console.log(`   price impact ${q.fill.priceImpactBps} bps`);
}

step(4, "Plan the trade as unsigned transactions (plan_trade)");
const p = await call("plan_trade", { symbol: "NVDA", side: "buy", size: "250", sizeUnit: "usd", maxSlippageBps: 50, account, tokenForm: "raw" });
if (p) {
  for (const st of p.steps) console.log(`   ${st.index}. ${bold(st.kind)}  ${st.description.replace(/(\d+\.\d{4})\d+/g, "$1")}`);
  for (const w of p.warnings) console.log(`   ${dim(`note: ${w}`)}`);
}

await mcp.close();
rl?.close();
console.log();
console.log(bold(`wallet after: ${usd(await buyer.balance())} ${net.asset.symbol}`));
