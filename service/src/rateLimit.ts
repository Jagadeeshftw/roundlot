import type { NextFunction, Request, Response } from "express";

// Fixed-window per-IP limiter, in memory (single instance, no database).
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - h.count)));
    if (h.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((h.resetAt - now) / 1000)));
      return res.status(429).json({ error: "rate_limited", retryAfterSeconds: Math.ceil((h.resetAt - now) / 1000) });
    }
    next();
  };
}
