import { z } from "zod";
import { planTrade, planTradeInput } from "./planTrade.js";
import { quote, quoteInput } from "./quote.js";
import { session, sessionInput } from "./session.js";

// One registry drives both surfaces: MCP tool registration and REST routes.
export interface PaidToolDef<S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> {
  name: string;
  restPath: string;
  price: `$${string}`;
  title: string;
  description: string;
  input: S;
  // A working REST query, shown in the catalog so agents don't guess names.
  example: string;
  run: (input: z.infer<S>) => Promise<unknown>;
}

const def = <S extends z.ZodObject<z.ZodRawShape>>(d: PaidToolDef<S>) => d as unknown as PaidToolDef;

export const PAID_TOOLS: PaidToolDef[] = [
  def({
    name: "quote",
    restPath: "/v1/quote",
    price: "$0.01",
    title: "Quote an xStock trade",
    description:
      "Price a buy or sell of NVDA, SPY or TSLA xStocks on X Layer against the live Uniswap v3 pool: amounts in and out, average price per share, price impact, and how the fill compares with the OKX spot book. Sizes in USD or shares. Refuses sizes the pool can't fill.",
    input: quoteInput,
    example: "symbol=NVDA&side=buy&size=250&sizeUnit=usd",
    run: quote,
  }),
  def({
    name: "session",
    restPath: "/v1/session",
    price: "$0.005",
    title: "Market session for an xStock",
    description:
      "Whether the US equity market is in regular, pre-market, after-hours or closed session (NYSE holidays and early closes included), what that means for the xStock's OKX price, and on-chain status: issuer pause, scheduled multiplier changes, pool liquidity.",
    input: sessionInput,
    example: "symbol=NVDA",
    run: session,
  }),
  def({
    name: "plan_trade",
    restPath: "/v1/plan-trade",
    price: "$0.02",
    title: "Plan an xStock trade (unsigned calldata)",
    description:
      "Build the ordered, unsigned X Layer mainnet transactions to execute a buy or sell: approvals, ERC-4626 wrap/unwrap and a SwapRouter02 swap with slippage limits and a deadline. Roundlot never holds keys; the account signs and sends each step in order.",
    input: planTradeInput,
    example: "symbol=NVDA&side=buy&size=250&sizeUnit=usd&account=0x5075ff68a0efb54db13423ad924bd680327d305e",
    run: planTrade,
  }),
];

export const TOOL_PRICES = Object.fromEntries(PAID_TOOLS.map((t) => [t.name, t.price])) as Record<string, `$${string}`>;

// Parameter list for the catalog, read from the same zod schemas that
// validate REST and MCP input.
export function describeParams(schema: z.ZodObject<z.ZodRawShape>) {
  return Object.entries(schema.shape).map(([name, field]) => {
    let t = field as z.ZodTypeAny;
    let required = true;
    let dflt: unknown;
    const description = t.description;
    for (;;) {
      if (t instanceof z.ZodOptional) required = false;
      else if (t instanceof z.ZodDefault) {
        required = false;
        dflt = t._def.defaultValue();
      } else if (!(t instanceof z.ZodEffects)) break;
      t = t instanceof z.ZodEffects ? t.innerType() : t._def.innerType;
    }
    const type =
      t instanceof z.ZodEnum
        ? (t.options as string[]).join(" | ")
        : t instanceof z.ZodNumber
          ? "number"
          : t instanceof z.ZodUnion
            ? "decimal"
            : "string";
    return { name, type, required, ...(dflt !== undefined ? { default: dflt } : {}), description };
  });
}
