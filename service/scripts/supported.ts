// Prints the payment kinds the configured facilitator supports.
// Usage: npx tsx --env-file=../.env scripts/supported.ts
import { loadConfig } from "../src/config.js";
import { createFacilitator } from "../src/x402/facilitator.js";

const cfg = loadConfig();
const facilitator = createFacilitator(cfg);
const supported = await facilitator.client.getSupported();
const kinds = supported.kinds.map((k) => `${k.scheme} ${k.network} (x402 v${k.x402Version})`);

console.log(`facilitator: ${facilitator.kind}`);
console.log(kinds.join("\n"));
console.log(
  kinds.some((k) => k.includes(cfg.payment.caip2))
    ? `OK: ${cfg.payment.caip2} is supported`
    : `MISSING: ${cfg.payment.caip2} is not in /supported`,
);
