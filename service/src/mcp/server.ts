import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Payments } from "../x402/payments.js";
import { withPayment } from "./paymentGate.js";

export interface McpDeps {
  cfg: Config;
  payments: Payments;
  catalog: () => unknown;
}

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

function buildServer({ cfg, payments, catalog }: McpDeps) {
  const server = new McpServer({ name: "roundlot", version: "0.1.0" });

  server.registerTool(
    "catalog",
    {
      title: "Roundlot catalog",
      description:
        "Free. Lists supported xStock symbols (NVDA, SPY, TSLA on X Layer), tool prices, and the data network (X Layer mainnet) vs payment network (X Layer testnet).",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(catalog()),
  );

  server.registerTool(
    "ping",
    {
      title: "Paid ping",
      description: "Costs $0.001. Returns a timestamp; used to check an x402 payment round trip.",
      inputSchema: { note: z.string().max(80).optional() },
      annotations: { readOnlyHint: true },
    },
    withPayment(payments, cfg, "ping", "Paid ping", async ({ note }: { note?: string }) =>
      json({ pong: true, note: note ?? null, at: new Date().toISOString() }),
    ),
  );

  return server;
}

// Stateless streamable HTTP: a fresh server + transport per request, so any
// replica can answer any call and there is no session state to lose.
export function mcpHandler(deps: McpDeps) {
  return async (req: Request, res: Response) => {
    const server = buildServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
