// Warm the production caches before recording: deep health (OKX + mainnet RPC),
// the catalog, and one paid quote from the demo wallet.
// Usage: BASE_URL=https://api.roundlot.0xo.in npx tsx --env-file=../.env scripts/warm.ts
import { paymentNetwork } from "../src/networks.js";
import { createBuyer } from "../src/x402/buyer.js";

const base = process.env.BASE_URL ?? "https://api.roundlot.0xo.in";
const time = async <T>(label: string, fn: () => Promise<T>) => {
  const t0 = Date.now();
  const out = await fn();
  console.log(`${label.padEnd(24)} ${String(Date.now() - t0).padStart(5)} ms`);
  return out;
};

const health = await time("health?deep=1", () => fetch(`${base}/health?deep=1`).then((r) => r.json()));
console.log(`   payments: ${JSON.stringify(health.payments)}`);
await time("catalog", () => fetch(`${base}/v1/catalog`).then((r) => r.json()));
for (const symbol of ["NVDA", "SPY", "TSLA"]) {
  await time(`catalog ${symbol}`, () => fetch(`${base}/v1/catalog?symbol=${symbol}`).then((r) => r.json()));
}

if (health.payments?.state !== "ready") {
  console.log("payments are not ready: skipping the paid quote");
  process.exit(1);
}
const buyer = createBuyer(process.env.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, paymentNetwork("eip155:1952"));
const { response, receipt } = await time("paid quote NVDA $250", () =>
  buyer.fetchPaid(`${base}/v1/quote?symbol=NVDA&side=buy&size=250`),
);
console.log(`   HTTP ${response.status} settled ${receipt?.success ? receipt.transaction : "NO"}`);
console.log(`   demo wallet ${(Number(await buyer.balance()) / 1e6).toFixed(3)} USD₮0`);
process.exit(response.ok && receipt?.success ? 0 : 1);
