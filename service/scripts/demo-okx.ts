// OKX's own tooling pays Roundlot: the onchainos CLI reads the x402 challenge,
// signs it locally with the demo wallet (payment pay-local, no OKX login), and
// decodes the receipt. Only the HTTP retry is ours.
// Usage: BASE_URL=https://api.roundlot.0xo.in npx tsx --env-file=../.env scripts/demo-okx.ts
import { execFileSync } from "node:child_process";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const url = `${base}/v1/quote?symbol=NVDA&side=buy&size=250`;
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const [bold, dim, cyan, green] = [paint("1"), paint("2"), paint("36"), paint("32")];

const onchainos = (args: string[], env: NodeJS.ProcessEnv = {}) => {
  const out = execFileSync("onchainos", args, { env: { ...process.env, ...env }, encoding: "utf8" });
  return JSON.parse(out.trim().split("\n")[0]!) as { ok: boolean; data: any };
};

console.log(bold("OKX onchainos CLI paying Roundlot"));
console.log(dim(`   GET ${url.replace(base, "")}`));

console.log();
console.log(bold("── 1. onchainos payment quote"));
const quote = onchainos(["payment", "quote", url]);
console.log(`   ${cyan("402")}  ${quote.data.summary}`);
console.log(`   pay to ${quote.data.decodedChallenge.recipient.slice(0, 10)}… on X Layer testnet`);

console.log();
console.log(bold("── 2. onchainos payment pay-local"));
const challenge = await fetch(url);
const required = challenge.headers.get("PAYMENT-REQUIRED");
if (challenge.status !== 402 || !required) throw new Error(`expected 402, got ${challenge.status}`);
const signed = onchainos(["payment", "pay-local", "--payload", required], {
  EVM_PRIVATE_KEY: process.env.DEMO_BUYER_PRIVATE_KEY,
});
console.log(`   signed EIP-3009 authorization from ${signed.data.wallet.slice(0, 10)}…`);

console.log();
console.log(bold("── 3. retry with PAYMENT-SIGNATURE"));
const paid = await fetch(url, { headers: { [signed.data.header_name]: signed.data.authorization_header } });
const body = (await paid.json()) as { fill?: { avgPricePerShare: number; priceImpactBps: number; receive: { shares: number } } };
console.log(`   HTTP ${paid.status}`);
if (body.fill) console.log(`   $250 → ${body.fill.receive.shares} NVDA shares at $${body.fill.avgPricePerShare}`);

console.log();
console.log(bold("── 4. onchainos payment decode-receipt"));
const header = paid.headers.get("PAYMENT-RESPONSE");
if (!header) throw new Error("no PAYMENT-RESPONSE header");
const receipt = onchainos(["payment", "decode-receipt", "--header", header]);
const tx = String(receipt.data.transaction);
console.log(`   ${green(String(receipt.data.status))} tx ${tx.slice(0, 6)}…${tx.slice(-4)}`);
console.log(dim(`   web3.okx.com/explorer/x-layer-testnet/tx/${tx.slice(0, 10)}…`));
