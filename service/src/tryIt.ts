import type { Request, Response } from "express";
import type { Config } from "./config.js";
import { txUrl } from "./networks.js";
import { XSTOCKS } from "./registry.js";
import { createBuyer } from "./x402/buyer.js";

// "Try it" for the landing page: the server's demo wallet pays for one real
// quote through the normal x402 path (HTTP 402 → signed authorization →
// facilitator settlement), so the visitor sees a genuine receipt and
// settlement transaction without a wallet of their own.

const MIN_BALANCE = 1_000_000n; // $1 of USD₮0 (6 dp)
const PER_IP = { windowMs: 60 * 60_000, max: 3 };

export function tryItHandler(cfg: Config) {
  const buyer = createBuyer(cfg.DEMO_BUYER_PRIVATE_KEY as `0x${string}`, cfg.payment);
  const self = `http://127.0.0.1:${cfg.PORT}`;
  const perIp = new Map<string, number[]>();
  let day = new Date().toISOString().slice(0, 10);
  let usedToday = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return async (req: Request, res: Response) => {
    const symbol = String(req.body?.symbol ?? "NVDA").toUpperCase();
    if (!XSTOCKS[symbol]) return res.status(400).json({ error: "unknown_symbol", supported: Object.keys(XSTOCKS) });

    const now = Date.now();
    const ip = req.ip ?? "unknown";
    const recent = (perIp.get(ip) ?? []).filter((t) => now - t < PER_IP.windowMs);
    if (recent.length >= PER_IP.max) {
      return res.status(429).json({ error: "try_it_limit", message: "Three tries per hour per visitor." });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      usedToday = 0;
    }
    if (usedToday >= cfg.TRY_IT_DAILY_CAP) {
      return res.status(429).json({ error: "try_it_daily_cap", message: "The demo wallet's daily budget is used up." });
    }

    // One paid call at a time keeps the demo wallet's spending predictable.
    const run = queue.then(async () => {
      const balance = await buyer.balance();
      if (balance < MIN_BALANCE) {
        return { status: 503, body: { error: "demo_wallet_low", message: "The demo wallet is below $1 of testnet USD₮0." } };
      }
      recent.push(now);
      perIp.set(ip, recent);
      usedToday++;
      const { response, receipt } = await buyer.fetchPaid(
        `${self}/v1/quote?symbol=${symbol}&side=buy&size=100&sizeUnit=usd`,
      );
      const result = await response.json();
      return {
        status: response.ok ? 200 : 502,
        body: {
          tool: "quote",
          request: { symbol, side: "buy", size: "100", sizeUnit: "usd" },
          price: "$0.01",
          result,
          receipt: receipt ?? null,
          settlement: receipt?.success
            ? { network: cfg.payment.caip2, transaction: receipt.transaction, explorer: txUrl(cfg.payment, receipt.transaction) }
            : null,
          payer: buyer.address,
        },
      };
    });
    queue = run.catch(() => undefined);

    try {
      const { status, body } = await run;
      res.status(status).json(body);
    } catch (err) {
      res.status(502).json({ error: "try_it_failed", message: err instanceof Error ? err.message : String(err) });
    }
  };
}
