import type { x402ResourceServer } from "@okxweb3/app-x402-express";
import type { Config } from "../config.js";
import { createFacilitator, type SelectedFacilitator } from "./facilitator.js";
import { createResourceServer } from "./resourceServer.js";

export type PaymentsStatus =
  | { state: "ready"; facilitator: SelectedFacilitator["kind"]; settler: string }
  | { state: "off"; facilitator: "off" }
  | { state: "unavailable"; facilitator: SelectedFacilitator["kind"]; reason: string };

export interface Payments {
  status: PaymentsStatus;
  // Present only when status.state === "ready".
  resourceServer?: x402ResourceServer;
}

// Payments are optional at boot: if the facilitator is switched off, or can't
// confirm it supports the payment network, the free tools keep serving and the
// paid ones answer "payments unavailable" instead of the whole service failing.
export async function setupPayments(cfg: Config): Promise<Payments> {
  if (cfg.FACILITATOR === "off") return { status: { state: "off", facilitator: "off" } };

  const facilitator = createFacilitator(cfg);
  const resourceServer = createResourceServer(facilitator, cfg);
  try {
    await resourceServer.initialize();
    if (!resourceServer.getSupportedKind(2, cfg.payment.caip2, "exact")) {
      throw new Error(`facilitator does not list exact/${cfg.payment.caip2} in /supported`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[payments] ${facilitator.kind} facilitator unavailable: ${reason}`);
    return { status: { state: "unavailable", facilitator: facilitator.kind, reason } };
  }
  return { status: { state: "ready", facilitator: facilitator.kind, settler: facilitator.settler }, resourceServer };
}
