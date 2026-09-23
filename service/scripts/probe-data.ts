// Live read of every data source for each supported xStock.
import { getMarket } from "../src/data/okx.js";
import { getPoolState, quoteExactIn } from "../src/data/pool.js";
import { getTokenState, toFloat18 } from "../src/data/xstock.js";
import { XSTOCKS } from "../src/registry.js";

for (const x of Object.values(XSTOCKS)) {
  const t0 = Date.now();
  const [m, t, p] = await Promise.all([getMarket(x.okxInstId), getTokenState(x), getPoolState(x)]);
  const perShare = p.stablePerWrapped / toFloat18(t.assetsPerWrapped);
  const q = await quoteExactIn(x.wrapped.address, x.pool.quote.address, x.pool.fee, 10n ** 18n);
  console.log(
    x.symbol,
    JSON.stringify({
      okxMid: m.mid, okxHost: m.host, poolPerWrapped: +p.stablePerWrapped.toFixed(4), assetsPerWrapped: toFloat18(t.assetsPerWrapped),
      poolPerShare: +perShare.toFixed(4), gapBps: +(((perShare - m.mid) / m.mid) * 1e4).toFixed(1),
      sell1Wrapped: Number(q.amountOut) / 10 ** x.pool.quote.decimals, partial: q.partial, paused: t.paused,
      pending: t.pendingMultiplier, block: t.blockNumber.toString(), ms: Date.now() - t0,
    }),
  );
}
