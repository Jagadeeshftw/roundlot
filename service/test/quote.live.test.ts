// Live reads against X Layer mainnet and OKX. Run with: LIVE=1 npx vitest run test/quote.live.test.ts
import { describe, expect, it } from "vitest";
import { quote } from "../src/tools/quote.js";
import { session } from "../src/tools/session.js";

describe.skipIf(!process.env.LIVE)("quote and session against live data", () => {
  it("per-share pool price is within 1% of the OKX mid", async () => {
    for (const symbol of ["NVDA", "SPY", "TSLA"]) {
      const q = await quote({ symbol, side: "buy", size: "100", sizeUnit: "usd" });
      expect(q.reference.available).toBe(true);
      const mid = (q.reference as { mid: number }).mid;
      expect(Math.abs(q.fill.poolMidPerShare - mid) / mid).toBeLessThan(0.01);
    }
  }, 60_000);

  it("buying exact shares receives exactly that many shares", async () => {
    const q = await quote({ symbol: "SPY", side: "buy", size: "2", sizeUnit: "shares" });
    expect(q.fill.receive.shares).toBe(2);
  }, 30_000);

  it("refuses sizes the pool cannot fill", async () => {
    await expect(quote({ symbol: "TSLA", side: "buy", size: "500000", sizeUnit: "usd" })).rejects.toMatchObject({
      code: "insufficient_liquidity",
    });
  }, 30_000);

  it("rejects unknown symbols", async () => {
    await expect(quote({ symbol: "AAPL", side: "buy", size: "1", sizeUnit: "usd" })).rejects.toMatchObject({ code: "unknown_symbol" });
  });

  it("session reports market state", async () => {
    const s = await session({ symbol: "NVDA" });
    expect(["pre_market", "regular", "post_market", "closed"]).toContain(s.usEquityMarket.phase);
    expect(s.onchain.tradable).toBe(true);
  }, 30_000);
});
