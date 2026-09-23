import { z } from "zod";
import { resolveSymbol, XSTOCKS, type XStock } from "../registry.js";

// Raised for caller errors and market conditions a tool refuses to serve.
// Paid tools never settle a payment when they throw one of these.
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
  toJSON() {
    return { error: this.code, message: this.message, ...this.details };
  }
}

const decimal = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0, "must be a positive decimal number");

export const symbolField = z
  .string()
  .min(1)
  .describe("xStock ticker: NVDA, SPY or TSLA (NVDAx / wNVDAx forms are accepted)");

export const sizeFields = {
  symbol: symbolField,
  side: z.enum(["buy", "sell"]).describe("buy = stablecoin → xStock, sell = xStock → stablecoin"),
  size: decimal.describe("Trade size, in the unit given by sizeUnit"),
  sizeUnit: z
    .enum(["usd", "shares"])
    .default("usd")
    .describe("usd = stablecoin notional; shares = xStock tokens (1 token ≈ 1 underlying share)"),
};

export function requireSymbol(input: string): XStock {
  const x = resolveSymbol(input);
  if (!x) throw new ToolError("unknown_symbol", `Unsupported symbol ${input}`, 400, { supported: Object.keys(XSTOCKS) });
  return x;
}

export const bps = (v: number) => Math.round(v * 1e4 * 10) / 10;
export const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
