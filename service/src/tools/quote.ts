import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { getMarket } from "../data/okx.js";
import { getPoolState, quoteExactIn, quoteExactOut, type SwapQuote } from "../data/pool.js";
import { getTokenState, toFloat18 } from "../data/xstock.js";
import { DATA_NETWORK } from "../networks.js";
import type { XStock } from "../registry.js";
import { bps, requireSymbol, round, sizeFields, ToolError } from "./common.js";

export const quoteInput = z.object(sizeFields);
export type QuoteInput = z.infer<typeof quoteInput>;

const ONE = 10n ** 18n;

// Everything plan_trade needs to build calldata from the same numbers the
// caller was quoted.
export interface Route {
  x: XStock;
  side: "buy" | "sell";
  exact: "input" | "output";
  swap: SwapQuote;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  wrappedAmount: bigint; // wrapped tokens swapped (sell) or received (buy)
  stableAmount: bigint; // stablecoin paid (buy) or received (sell)
  sharesAmount: bigint; // raw xStock tokens equivalent, 1e18-scaled
  assetsPerWrapped: bigint;
  blockNumber: bigint;
}

export async function route(input: QuoteInput): Promise<Route> {
  const x = requireSymbol(input.symbol);
  const token = await getTokenState(x);
  if (token.paused) throw new ToolError("token_paused", `${x.raw.symbol} transfers are paused by the issuer`);

  const stable = x.pool.quote;
  const wrapped = x.wrapped.address;
  const apw = token.assetsPerWrapped;
  const sharesToWrapped = (shares: bigint) => (shares * ONE) / apw;
  const wrappedToShares = (w: bigint) => (w * apw) / ONE;

  let swap: SwapQuote;
  let exact: Route["exact"];
  if (input.side === "buy") {
    if (input.sizeUnit === "usd") {
      exact = "input";
      swap = await quoteExactIn(stable.address, wrapped, x.pool.fee, parseUnits(input.size, stable.decimals));
    } else {
      exact = "output";
      swap = await quoteExactOut(stable.address, wrapped, x.pool.fee, sharesToWrapped(parseUnits(input.size, 18)));
    }
  } else if (input.sizeUnit === "shares") {
    exact = "input";
    swap = await quoteExactIn(wrapped, stable.address, x.pool.fee, sharesToWrapped(parseUnits(input.size, 18)));
  } else {
    exact = "output";
    swap = await quoteExactOut(wrapped, stable.address, x.pool.fee, parseUnits(input.size, stable.decimals));
  }

  if (swap.partial || swap.amountIn === 0n || swap.amountOut === 0n) {
    throw new ToolError(
      "insufficient_liquidity",
      `The ${x.wrapped.symbol}/${stable.symbol} pool cannot fill ${input.size} ${input.sizeUnit} without running out of in-range liquidity. Try a smaller size.`,
    );
  }

  const buy = input.side === "buy";
  const wrappedAmount = buy ? swap.amountOut : swap.amountIn;
  return {
    x,
    side: input.side,
    exact,
    swap,
    tokenIn: buy ? stable.address : wrapped,
    tokenOut: buy ? wrapped : stable.address,
    wrappedAmount,
    stableAmount: buy ? swap.amountIn : swap.amountOut,
    sharesAmount: wrappedToShares(wrappedAmount),
    assetsPerWrapped: apw,
    blockNumber: token.blockNumber,
  };
}

export async function quote(input: QuoteInput) {
  const [r, pool, market] = await Promise.all([
    route(input),
    getPoolState(requireSymbol(input.symbol)),
    getMarket(requireSymbol(input.symbol).okxInstId).catch((err: Error) => err),
  ]);
  const { x } = r;
  const stable = x.pool.quote;
  const apw = toFloat18(r.assetsPerWrapped);
  const shares = toFloat18(r.sharesAmount);
  const stableAmt = Number(formatUnits(r.stableAmount, stable.decimals));
  const avgPerShare = stableAmt / shares;
  const midPerShare = pool.stablePerWrapped / apw;
  const buy = r.side === "buy";

  const reference =
    market instanceof Error
      ? { venue: "OKX spot", instId: x.okxInstId, available: false, error: market.message }
      : {
          venue: "OKX spot",
          instId: x.okxInstId,
          available: true,
          bid: market.bid,
          ask: market.ask,
          mid: market.mid,
          spreadBps: round(market.spreadBps, 1),
          at: market.ts,
          // Positive = the on-chain fill beats crossing the OKX book.
          onchainEdgeBps: bps(buy ? (market.ask - avgPerShare) / market.ask : (avgPerShare - market.bid) / market.bid),
        };

  return {
    symbol: x.symbol,
    side: r.side,
    size: { amount: input.size, unit: input.sizeUnit },
    fill: {
      venue: "Uniswap v3",
      pool: pool.address,
      feeBps: x.pool.fee / 100,
      pay: buy
        ? { token: stable.symbol, amount: formatUnits(r.stableAmount, stable.decimals) }
        : { token: x.wrapped.symbol, amount: formatUnits(r.wrappedAmount, 18), shares: round(shares, 8) },
      receive: buy
        ? { token: x.wrapped.symbol, amount: formatUnits(r.wrappedAmount, 18), shares: round(shares, 8) }
        : { token: stable.symbol, amount: formatUnits(r.stableAmount, stable.decimals) },
      avgPricePerShare: round(avgPerShare, 4),
      poolMidPerShare: round(midPerShare, 4),
      priceImpactBps: bps(buy ? (avgPerShare - midPerShare) / midPerShare : (midPerShare - avgPerShare) / midPerShare),
      gasEstimate: r.swap.gasEstimate.toString(),
    },
    reference,
    units: {
      sharesPerWrappedToken: apw,
      note: `Pool prices are per wrapped token (${x.wrapped.symbol}); they are divided by the ERC-4626 rate to get a per-share price comparable to OKX. ${stable.symbol} and USDT are treated 1:1.`,
    },
    data: { network: DATA_NETWORK.caip2, blockNumber: r.blockNumber.toString(), quotedAt: new Date().toISOString() },
  };
}
