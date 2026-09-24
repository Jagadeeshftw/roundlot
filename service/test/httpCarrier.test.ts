import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { carrierFor } from "../src/mcp/httpCarrier.js";

const req = (headers: Record<string, string> = {}, query: Record<string, string> = {}, body: unknown = {}) =>
  ({
    query,
    body,
    get: (name: string) => headers[name.toLowerCase()],
  }) as unknown as Request;

describe("carrierFor", () => {
  it("official MCP SDK clients (send MCP-Protocol-Version) get the in-band _meta carrier", () => {
    expect(carrierFor(req({ "mcp-protocol-version": "2025-06-18" }))).toBe("meta");
  });
  it("clients without the header (onchainos) get HTTP 402", () => {
    expect(carrierFor(req())).toBe("http");
  });
  it("a PAYMENT-SIGNATURE header always means HTTP", () => {
    expect(carrierFor(req({ "payment-signature": "x", "mcp-protocol-version": "2025-06-18" }))).toBe("http");
  });
  it("a payload in _meta means in-band", () => {
    expect(carrierFor(req({}, {}, { params: { _meta: { "x402/payment": {} } } }))).toBe("meta");
  });
  it("?payment= forces either carrier", () => {
    expect(carrierFor(req({ "mcp-protocol-version": "2025-06-18" }, { payment: "http" }))).toBe("http");
    expect(carrierFor(req({}, { payment: "meta" }))).toBe("meta");
  });
});
