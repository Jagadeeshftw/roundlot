import express from "express";
import { paymentMiddleware } from "@okxweb3/app-x402-express";
import { buildCatalog } from "./catalog.js";
import type { Config } from "./config.js";
import { mcpHandler } from "./mcp/server.js";
import { setupPayments } from "./x402/payments.js";
import { acceptsFor, TOOL_PRICES } from "./x402/resourceServer.js";

export async function createApp(cfg: Config) {
  const payments = await setupPayments(cfg);
  const catalog = () => buildCatalog(cfg, payments.status);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, paymentNetwork: cfg.payment.caip2, payments: payments.status });
  });

  // OKX.AI's marketplace calls listed endpoints as plain REST (POST {} by
  // default), so the free catalog answers both GET and POST.
  app.route("/v1/catalog").get((_req, res) => res.json(catalog())).post((_req, res) => res.json(catalog()));

  if (payments.resourceServer) {
    app.use(
      paymentMiddleware(
        {
          "GET /v1/ping": {
            accepts: acceptsFor("ping", cfg),
            description: "Paid ping",
            mimeType: "application/json",
          },
        },
        payments.resourceServer,
      ),
    );
  } else {
    const paidPaths = Object.keys(TOOL_PRICES).map((t) => `/v1/${t}`);
    app.use(paidPaths, (_req, res) => {
      res.status(503).json({ error: "payments_unavailable", payments: payments.status });
    });
  }

  app.get("/v1/ping", (_req, res) => {
    res.json({ pong: true, at: new Date().toISOString() });
  });

  const mcp = mcpHandler({ cfg, payments, catalog });
  app.post("/mcp", (req, res, next) => mcp(req, res).catch(next));
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json({ error: "Use POST for MCP streamable HTTP (stateless)." });
  });

  return { app, payments };
}
