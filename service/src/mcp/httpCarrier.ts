import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@okxweb3/app-x402-core/http";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { MCP_PAYMENT_META_KEY } from "./paymentGate.js";

// x402 over MCP has two carriers in the wild:
//  - in-band (@x402/mcp): HTTP 200, PaymentRequired in the tool result, payment
//    in params._meta["x402/payment"], receipt in result._meta.
//  - HTTP (OKX's onchainos CLI): the paid tools/call answers HTTP 402 with a
//    PAYMENT-REQUIRED header; the retry carries PAYMENT-SIGNATURE; the receipt
//    comes back in a PAYMENT-RESPONSE header.
// The payment gate is the same for both; this middleware only moves the
// payload and the outcome between headers and the JSON-RPC body.
//
// Choosing a carrier per request: a PAYMENT-SIGNATURE header or ?payment=http
// means HTTP; ?payment=meta or a payload in _meta means in-band. Otherwise,
// clients that send MCP-Protocol-Version (required by the 2025-06-18 spec, sent
// by the official SDKs, which reject non-2xx responses) get in-band, and
// clients that don't (onchainos) get HTTP 402.

interface CarrierOutcome {
  required?: PaymentRequired;
  settled?: SettleResponse;
}

const outcome = new AsyncLocalStorage<CarrierOutcome>();

// Called by the payment gate; no-ops outside an HTTP-carrier request.
export function reportPaymentRequired(pr: PaymentRequired) {
  const o = outcome.getStore();
  if (o) o.required = pr;
}
export function reportSettled(s: SettleResponse) {
  const o = outcome.getStore();
  if (o) o.settled = s;
}

export function carrierFor(req: Request): "http" | "meta" {
  const forced = req.query.payment;
  if (forced === "http" || forced === "meta") return forced;
  if (req.get("PAYMENT-SIGNATURE")) return "http";
  if (req.body?.params?._meta?.[MCP_PAYMENT_META_KEY]) return "meta";
  return req.get("MCP-Protocol-Version") ? "meta" : "http";
}

export function mcpHttpCarrier(paidTools: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    const isPaidCall =
      body && !Array.isArray(body) && body.method === "tools/call" && paidTools.has(body.params?.name);
    if (!isPaidCall || carrierFor(req) === "meta") return next();

    const signature = req.get("PAYMENT-SIGNATURE");
    if (signature) {
      try {
        const payload = decodePaymentSignatureHeader(signature);
        body.params._meta = { ...body.params._meta, [MCP_PAYMENT_META_KEY]: payload };
      } catch {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: body.id ?? null,
          error: { code: -32602, message: "PAYMENT-SIGNATURE is not a valid x402 payment payload" },
        });
      }
    }

    const o: CarrierOutcome = {};
    // The transport writes the whole JSON response in one writeHead/end once
    // the tool has run, so the outcome is known by the time headers go out.
    const writeHead = res.writeHead.bind(res) as (...a: unknown[]) => Response;
    res.writeHead = ((status: number, ...rest: unknown[]) => {
      if (o.settled) {
        res.setHeader("PAYMENT-RESPONSE", encodePaymentResponseHeader(o.settled));
      } else if (o.required) {
        res.setHeader("PAYMENT-REQUIRED", encodePaymentRequiredHeader(o.required));
        return writeHead(402, ...rest);
      }
      return writeHead(status, ...rest);
    }) as Response["writeHead"];

    outcome.run(o, () => next());
  };
}
