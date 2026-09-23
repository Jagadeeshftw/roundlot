import type { PaymentNetwork } from "./networks.js";
import { txUrl } from "./networks.js";

// Last settlements, in memory (resets on deploy; the explorer is the durable
// record). Fed by the resource server's after-settle hook, so REST, MCP and
// Try-it payments all show up.
export interface Settlement {
  at: string;
  resource: string;
  amount: string;
  payer: string | null;
  transaction: string;
  status: string;
  explorer: string;
}

const MAX = 25;
const recent: Settlement[] = [];

export function recordSettlement(net: PaymentNetwork, s: Omit<Settlement, "at" | "explorer">) {
  const entry = { at: new Date().toISOString(), ...s, explorer: txUrl(net, s.transaction) };
  recent.unshift(entry);
  recent.length = Math.min(recent.length, MAX);
  console.log(`[settled] ${entry.resource} ${entry.amount} from ${entry.payer ?? "?"} tx ${entry.transaction} (${entry.status})`);
}

export const recentSettlements = () => [...recent];
