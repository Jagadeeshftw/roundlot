import type { Config } from "./config.js";
import { DATA_NETWORK } from "./networks.js";
import { XSTOCKS } from "./registry.js";
import { PAID_TOOLS } from "./tools/index.js";
import type { PaymentsStatus } from "./x402/payments.js";

export function buildCatalog(cfg: Config, payments: PaymentsStatus) {
  return {
    service: "Roundlot",
    description:
      "Paid market-data and trade-planning tools for tokenized equities (xStocks) on X Layer, for AI agents. Pay per call with x402.",
    networks: {
      data: {
        network: DATA_NETWORK.caip2,
        name: DATA_NETWORK.name,
        note: "Token metadata, Uniswap v3 pool state and trade calldata come from X Layer mainnet.",
      },
      payment: {
        network: cfg.payment.caip2,
        name: cfg.payment.name,
        asset: cfg.payment.asset,
        payTo: cfg.PAY_TO,
        facilitator: payments.facilitator,
        status: payments.state,
        note: "Payments settle on X Layer testnet so nobody spends real money on a demo. Mainnet payments are configured but disabled.",
      },
    },
    symbols: Object.values(XSTOCKS).map((x) => ({
      symbol: x.symbol,
      underlying: x.underlying,
      token: x.raw,
      wrapped: x.wrapped,
      venue: { dex: "Uniswap v3", quote: x.pool.quote.symbol, feeBps: x.pool.fee / 100 },
      reference: { venue: "OKX spot", instId: x.okxInstId },
    })),
    tools: [
      { name: "catalog", price: "free", rest: "/v1/catalog", description: "This document." },
      ...PAID_TOOLS.map((t) => ({
        name: t.name,
        price: t.price,
        asset: cfg.payment.asset.symbol,
        rest: t.restPath,
        description: t.description,
      })),
    ],
    endpoints: {
      mcp: `${cfg.PUBLIC_BASE_URL}/mcp`,
      rest: `${cfg.PUBLIC_BASE_URL}/v1`,
    },
  };
}
