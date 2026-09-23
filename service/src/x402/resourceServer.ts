import { x402ResourceServer } from "@okxweb3/app-x402-express";
import { ExactEvmScheme } from "@okxweb3/app-x402-evm/exact/server";
import type { Config } from "../config.js";
import type { SelectedFacilitator } from "./facilitator.js";

// Prices in USD; the exact scheme converts to USD₮0 atomic units (6 dp) using
// the default asset the SDK registers for the payment network.
export const TOOL_PRICES = {
  ping: "$0.001",
} as const satisfies Record<string, `$${string}`>;

export type PaidTool = keyof typeof TOOL_PRICES;

export function createResourceServer(facilitator: SelectedFacilitator, cfg: Config) {
  return new x402ResourceServer(facilitator.client).register(cfg.payment.caip2, new ExactEvmScheme());
}

export function acceptsFor(tool: PaidTool, cfg: Config) {
  return {
    scheme: "exact",
    network: cfg.payment.caip2,
    payTo: cfg.PAY_TO,
    price: TOOL_PRICES[tool],
    maxTimeoutSeconds: 120,
  };
}
