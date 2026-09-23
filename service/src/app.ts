import express from "express";
import { paymentMiddleware } from "@okxweb3/app-x402-express";
import { buildCatalog } from "./catalog.js";
import type { Config } from "./config.js";
import { mcpHandler } from "./mcp/server.js";
import { createFacilitator } from "./x402/facilitator.js";
import { acceptsFor, createResourceServer } from "./x402/resourceServer.js";

export async function createApp(cfg: Config) {
  const facilitator = createFacilitator(cfg);
  const resourceServer = createResourceServer(facilitator, cfg);
  // Fetches the facilitator's /supported kinds; fails loudly if the payment
  // network isn't supported rather than 402-ing with unusable requirements.
  await resourceServer.initialize();

  const catalog = () => buildCatalog(cfg, facilitator);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, paymentNetwork: cfg.payment.caip2, facilitator: facilitator.kind });
  });

  app.get("/v1/catalog", (_req, res) => {
    res.json(catalog());
  });

  app.use(
    paymentMiddleware(
      {
        "GET /v1/ping": {
          accepts: acceptsFor("ping", cfg),
          description: "Paid ping",
          mimeType: "application/json",
        },
      },
      resourceServer,
    ),
  );

  app.get("/v1/ping", (_req, res) => {
    res.json({ pong: true, at: new Date().toISOString() });
  });

  const mcp = mcpHandler({ cfg, resourceServer, catalog });
  app.post("/mcp", (req, res, next) => mcp(req, res).catch(next));
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json({ error: "Use POST for MCP streamable HTTP (stateless)." });
  });

  return { app, facilitator, resourceServer };
}
