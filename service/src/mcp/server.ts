import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import type { Config } from "../config.js";
import { ToolError } from "../tools/common.js";
import { PAID_TOOLS } from "../tools/index.js";
import type { Payments } from "../x402/payments.js";
import { withPayment } from "./paymentGate.js";

export interface McpDeps {
  cfg: Config;
  payments: Payments;
  catalog: () => unknown;
}

const json = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

// Tool errors come back as isError results, which the payment gate treats as
// "don't settle": a refused quote or plan is never charged.
async function runTool(run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return json(await run());
  } catch (err) {
    if (err instanceof ToolError) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify(err.toJSON()) }] };
    }
    throw err;
  }
}

function buildServer({ cfg, payments, catalog }: McpDeps) {
  const server = new McpServer({ name: "roundlot", version: "0.1.0" });

  server.registerTool(
    "catalog",
    {
      title: "Roundlot catalog",
      description:
        "Free. Supported xStocks (NVDA, SPY, TSLA on X Layer), tool prices, and the data network (X Layer mainnet) vs payment network (X Layer testnet).",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(catalog()),
  );

  for (const tool of PAID_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: `${tool.description} Costs ${tool.price} per call in ${cfg.payment.asset.symbol} on ${cfg.payment.name}, paid with x402.`,
        inputSchema: tool.input.shape,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      withPayment(payments, cfg, tool.name, tool.title, (args: Record<string, unknown>) =>
        runTool(() => tool.run(tool.input.parse(args))),
      ),
    );
  }

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
