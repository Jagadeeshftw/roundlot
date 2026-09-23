import express, { type NextFunction, type Request, type Response } from "express";
import { paymentMiddleware } from "@okxweb3/app-x402-express";
import { buildCatalog } from "./catalog.js";
import type { Config } from "./config.js";
import { recentSettlements } from "./activity.js";
import { cache } from "./data/cache.js";
import { mainnet } from "./data/chain.js";
import { getMarket } from "./data/okx.js";
import { mcpHandler } from "./mcp/server.js";
import { rateLimit } from "./rateLimit.js";
import { resolveSymbol, XSTOCKS } from "./registry.js";
import { tryItHandler } from "./tryIt.js";
import { ToolError } from "./tools/common.js";
import { PAID_TOOLS } from "./tools/index.js";
import { setupPayments } from "./x402/payments.js";
import { acceptsFor } from "./x402/resourceServer.js";

export async function createApp(cfg: Config) {
  const payments = await setupPayments(cfg);
  const catalog = () => buildCatalog(cfg, payments.status);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  app.get("/", (_req, res) => {
    res.json({ service: "Roundlot", catalog: "/v1/catalog", mcp: "/mcp", health: "/health" });
  });

  // ?deep=1 also proves the upstreams are reachable from where we run
  // (OKX market data and the X Layer mainnet RPC).
  app.get("/health", async (req, res) => {
    const base = { ok: true, paymentNetwork: cfg.payment.caip2, payments: payments.status, cache: cache.stats() };
    if (req.query.deep !== "1") return res.json(base);
    const [okx, rpc] = await Promise.allSettled([getMarket("XNVDA-USDT"), mainnet.getBlockNumber()]);
    const upstreams = {
      okx: okx.status === "fulfilled" ? { ok: true, host: okx.value.host, at: okx.value.ts } : { ok: false, error: String(okx.reason) },
      mainnetRpc: rpc.status === "fulfilled" ? { ok: true, blockNumber: rpc.value.toString() } : { ok: false, error: String(rpc.reason) },
    };
    res.status(upstreams.okx.ok && upstreams.mainnetRpc.ok ? 200 : 503).json({ ...base, ok: upstreams.okx.ok && upstreams.mainnetRpc.ok, upstreams });
  });

  // The landing page calls the API from the browser; x402 headers must be
  // readable cross-origin.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && cfg.CORS_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, PAYMENT-SIGNATURE, Mcp-Session-Id, Mcp-Protocol-Version");
      res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, RateLimit-Remaining, Retry-After");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(["/v1", "/mcp"], rateLimit({ windowMs: 60_000, max: 60 }));

  app.get("/v1/activity", (_req, res) => {
    res.json({ network: cfg.payment.caip2, settlements: recentSettlements() });
  });

  const tryIt = cfg.TRY_IT_ENABLED && payments.resourceServer ? tryItHandler(cfg) : undefined;
  app.post("/v1/try", (req, res) => {
    if (!tryIt) return res.status(404).json({ error: "try_it_disabled" });
    return tryIt(req, res);
  });

  // OKX.AI's marketplace calls listed endpoints as plain REST (POST {} by
  // default), so the free catalog answers both GET and POST.
  const catalogRoute = (symbol: unknown, res: Response) => {
    if (symbol === undefined || symbol === "") return res.json(catalog());
    const x = typeof symbol === "string" ? resolveSymbol(symbol) : undefined;
    if (!x) {
      return res.status(400).json({ error: "unknown_symbol", supported: Object.keys(XSTOCKS) });
    }
    const full = catalog();
    return res.json({ ...full, symbols: full.symbols.filter((s) => s.symbol === x.symbol) });
  };
  app
    .route("/v1/catalog")
    .get((req, res) => catalogRoute(req.query.symbol, res))
    .post((req, res) => catalogRoute(req.body?.symbol, res));

  // Validate paid-tool input before asking for payment, so a malformed call
  // gets a 400 instead of a 402 it can't use.
  for (const tool of PAID_TOOLS) {
    app.use(tool.restPath, (req, res, next) => {
      if (req.method !== "GET" && req.method !== "POST") return next();
      const parsed = tool.input.safeParse(req.method === "GET" ? req.query : (req.body ?? {}));
      if (!parsed.success) {
        return res.status(400).json({
          error: "invalid_input",
          issues: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        });
      }
      if (!resolveSymbol(String(parsed.data.symbol))) {
        return res.status(400).json({ error: "unknown_symbol", supported: Object.keys(XSTOCKS) });
      }
      res.locals.input = parsed.data;
      next();
    });
  }

  if (payments.resourceServer) {
    const routes = Object.fromEntries(
      PAID_TOOLS.flatMap((tool) =>
        (["GET", "POST"] as const).map((method) => [
          `${method} ${tool.restPath}`,
          { accepts: acceptsFor(tool.name, cfg), description: tool.title, mimeType: "application/json" },
        ]),
      ),
    );
    // The middleware settles only after the handler returns 2xx, so refused
    // quotes and plans are never charged.
    app.use(paymentMiddleware(routes, payments.resourceServer));
  } else {
    app.use(
      PAID_TOOLS.map((t) => t.restPath),
      (_req, res) => {
        res.status(503).json({ error: "payments_unavailable", payments: payments.status });
      },
    );
  }

  for (const tool of PAID_TOOLS) {
    const handler = async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(await tool.run(res.locals.input));
      } catch (err) {
        if (err instanceof ToolError) return res.status(err.httpStatus).json(err.toJSON());
        next(err);
      }
    };
    app.get(tool.restPath, handler);
    app.post(tool.restPath, handler);
  }

  const mcp = mcpHandler({ cfg, payments, catalog });
  app.post("/mcp", (req, res, next) => mcp(req, res).catch(next));
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json({ error: "Use POST for MCP streamable HTTP (stateless)." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (!res.headersSent) {
      res.status(502).json({ error: "upstream_error", message: err instanceof Error ? err.message : String(err) });
    }
  });

  return { app, payments };
}
