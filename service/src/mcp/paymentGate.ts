import type { PaymentPayload } from "@okxweb3/app-x402-core/types";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../config.js";
import type { Payments } from "../x402/payments.js";
import { acceptsFor } from "../x402/resourceServer.js";
import { reportPaymentRequired, reportSettled } from "./httpCarrier.js";

// Per-tool x402 over MCP, wire-compatible with @x402/mcp:
//  - unpaid call      -> isError result, PaymentRequired in structuredContent and
//                        JSON-encoded in content[0].text
//  - paid retry       -> client sends the signed payload in _meta["x402/payment"]
//  - success          -> settlement receipt in result _meta["x402/payment-response"]
// Implemented on OKX's app-x402-core so the process has a single x402 core.
// httpCarrier.ts adds the HTTP 402 / PAYMENT-SIGNATURE carrier on top.
export const MCP_PAYMENT_META_KEY = "x402/payment";
export const MCP_PAYMENT_RESPONSE_META_KEY = "x402/payment-response";

type Extra = { _meta?: Record<string, unknown> };

export function withPayment<A>(
  payments: Payments,
  cfg: Config,
  tool: string,
  description: string,
  handler: (args: A, extra: Extra) => Promise<CallToolResult>,
) {
  const resourceInfo = { url: `mcp://tool/${tool}`, description, mimeType: "application/json" };

  return async (args: A, extra: Extra): Promise<CallToolResult> => {
    const server = payments.resourceServer;
    if (!server) {
      return {
        isError: true,
        content: [{ type: "text", text: `Payments are unavailable right now (${JSON.stringify(payments.status)}); ${tool} cannot be served.` }],
      };
    }
    const requirements = await server.buildPaymentRequirementsFromOptions([acceptsFor(tool, cfg)], {});

    const paymentRequired = async (reason: string): Promise<CallToolResult> => {
      const pr = await server.createPaymentRequiredResponse(requirements, resourceInfo, reason);
      reportPaymentRequired(pr);
      const price = acceptsFor(tool, cfg).price;
      return {
        isError: true,
        structuredContent: pr as unknown as Record<string, unknown>,
        content: [
          { type: "text", text: JSON.stringify(pr) },
          {
            type: "text",
            text:
              `${tool} costs ${price} in ${cfg.payment.asset.symbol} on ${cfg.payment.name} (${cfg.payment.caip2}). ` +
              `Pay with an x402-capable MCP client, or call the REST endpoint listed in the catalog with an x402 HTTP client. ` +
              `Reason: ${reason}`,
          },
        ],
      };
    };

    const payload = extra._meta?.[MCP_PAYMENT_META_KEY] as PaymentPayload | undefined;
    if (!payload) return paymentRequired("Payment required to access this tool");

    const match = server.findMatchingRequirements(requirements, payload);
    if (!match) return paymentRequired("No matching payment requirements found");

    const verified = await server.verifyPayment(payload, match);
    if (!verified.isValid) return paymentRequired(verified.invalidReason ?? "Payment verification failed");

    const result = await handler(args, extra);
    // A failed tool call is not charged: the authorization is simply never submitted.
    if (result.isError) return result;

    const settled = await server.settlePayment(payload, match);
    if (!settled.success) {
      return paymentRequired(`Payment settlement failed: ${settled.errorReason ?? "unknown"}`);
    }
    reportSettled(settled);
    return { ...result, _meta: { ...result._meta, [MCP_PAYMENT_RESPONSE_META_KEY]: settled } };
  };
}
