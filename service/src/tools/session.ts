import { z } from "zod";
import { getInstrument, getMarket } from "../data/okx.js";
import { getPoolState } from "../data/pool.js";
import { getTokenState, toFloat18 } from "../data/xstock.js";
import { DATA_NETWORK } from "../networks.js";
import { equitySession } from "./calendar.js";
import { requireSymbol, symbolField } from "./common.js";

export const sessionInput = z.object({ symbol: symbolField });
export type SessionInput = z.infer<typeof sessionInput>;

export async function session(input: SessionInput) {
  const x = requireSymbol(input.symbol);
  const [token, pool, instrument, market] = await Promise.all([
    getTokenState(x),
    getPoolState(x),
    getInstrument(x.okxInstId).catch((err: Error) => err),
    getMarket(x.okxInstId).catch((err: Error) => err),
  ]);
  const us = equitySession();
  const okxLive = !(instrument instanceof Error) && instrument.state === "live";
  const pending = token.pendingMultiplier;

  const warnings: string[] = [];
  if (us.phase !== "regular") {
    warnings.push("US market is not in regular hours: OKX prices are last close plus a market estimate, not a live underlying price.");
  }
  if (pending) warnings.push(`A multiplier change is scheduled for ${new Date(pending.activatesAt * 1000).toISOString()}.`);
  if (instrument instanceof Error) warnings.push(`OKX instrument status unavailable: ${instrument.message}`);
  else if (!okxLive) warnings.push(`OKX instrument state is "${instrument.state}".`);

  return {
    symbol: x.symbol,
    underlying: x.underlying,
    usEquityMarket: us,
    okx: instrument instanceof Error
      ? { instId: x.okxInstId, available: false }
      : {
          instId: x.okxInstId,
          state: instrument.state,
          tradesAroundTheClock: true,
          pricing: us.phase === "regular" ? "live underlying market" : "last close plus market estimate",
          lastUpdate: market instanceof Error ? null : market.ts,
        },
    token: {
      address: x.raw.address,
      paused: token.paused,
      multiplier: toFloat18(token.multiplier),
      pendingMultiplier: pending
        ? { value: toFloat18(pending.value), activatesAt: new Date(pending.activatesAt * 1000).toISOString() }
        : null,
    },
    onchain: {
      pool: pool.address,
      inRangeLiquidity: pool.liquidity > 0n,
      tradable: !token.paused && pool.liquidity > 0n,
    },
    warnings,
    data: { network: DATA_NETWORK.caip2, blockNumber: token.blockNumber.toString(), at: new Date().toISOString() },
  };
}
