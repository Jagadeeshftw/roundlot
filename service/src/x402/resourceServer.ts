import { x402ResourceServer } from "@okxweb3/app-x402-express";
import { ExactEvmScheme } from "@okxweb3/app-x402-evm/exact/server";
import type { Config } from "../config.js";
import { TOOL_PRICES } from "../tools/index.js";
import type { SelectedFacilitator } from "./facilitator.js";

export function createResourceServer(facilitator: SelectedFacilitator, cfg: Config) {
  return new x402ResourceServer(facilitator.client).register(cfg.payment.caip2, new ExactEvmScheme());
}

// Prices are in USD; the exact scheme converts to USD₮0 atomic units (6 dp)
// using the default asset the SDK registers for the payment network.
export function acceptsFor(tool: string, cfg: Config) {
  const price = TOOL_PRICES[tool];
  if (!price) throw new Error(`No price for tool ${tool}`);
  return {
    scheme: "exact",
    network: cfg.payment.caip2,
    payTo: cfg.PAY_TO,
    price,
    maxTimeoutSeconds: 120,
  };
}
