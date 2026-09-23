// End-to-end payment check: pays GET /v1/session over REST and the `session`
// tool over MCP from DEMO_BUYER, printing each settlement.
// Usage: BASE_URL=http://localhost:3000 npx tsx --env-file=../.env scripts/spike.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "../src/mcp/paymentGate.js";
import { paymentNetwork, txUrl } from "../src/networks.js";
import { createBuyer } from "../src/x402/buyer.js";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const net = paymentNetwork(process.env.PAYMENT_NETWORK ?? "eip155:1952");
if (process.env.PAYMENT_RPC_URL) net.rpcUrl = process.env.PAYMENT_RPC_URL;
const buyer = createBuyer(process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, net);

const fmt = (v: bigint) => `${Number(v) / 10 ** net.asset.decimals} ${net.asset.symbol}`;
const show = (label: string, r?: SettleResponse) =>
  console.log(label, r?.success ? `settled ${r.transaction} ${txUrl(net, r.transaction)}` : `NOT settled ${JSON.stringify(r)}`);

console.log(`buyer ${buyer.address} balance ${fmt(await buyer.balance())}`);

// REST
const rest = await buyer.fetchPaid(`${base}/v1/session?symbol=NVDA`);
const restBody = (await rest.response.json()) as { usEquityMarket?: { phase: string } };
console.log("REST status", rest.response.status, "phase", restBody.usEquityMarket?.phase);
show("REST", rest.receipt);

// MCP
const mcp = new Client({ name: "roundlot-spike", version: "0.0.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
const args = { symbol: "TSLA" };
const unpaid = await mcp.callTool({ name: "session", arguments: args });
if (!unpaid.isError || !unpaid.structuredContent) throw new Error(`expected payment-required, got ${JSON.stringify(unpaid)}`);
const payload = await buyer.createPayment(unpaid.structuredContent as unknown as PaymentRequired);
const paid = await mcp.callTool({ name: "session", arguments: args, _meta: { [MCP_PAYMENT_META_KEY]: payload } });
console.log("MCP isError", paid.isError ?? false, "symbol", (paid.structuredContent as { symbol?: string } | undefined)?.symbol);
show("MCP", paid._meta?.[MCP_PAYMENT_RESPONSE_META_KEY] as SettleResponse | undefined);
await mcp.close();

console.log(`buyer balance after ${fmt(await buyer.balance())}`);
