# Roundlot

Pay-per-call market data and trade planning for tokenized US equities (xStocks) on X Layer, built for AI agents.

Roundlot is an MCP server (streamable HTTP) and a REST API with the same tools. An agent can quote a buy or sell of NVDA, SPY or TSLA xStocks against live Uniswap v3 liquidity, check whether the US market is open and what that means for the token's price, and get the ordered, unsigned transactions to execute the trade. Paid tools are gated per call with [x402](https://github.com/okx/payments) using OKX's payment SDK. Roundlot never holds keys or funds.

Built for OKX Dev Day 2026 (Build a Company track, remote), 17–25 September 2026.

- **API:** https://api.roundlot.0xo.in (catalog: [`/v1/catalog`](https://api.roundlot.0xo.in/v1/catalog), MCP: `/mcp`)
- **OKX.AI:** A2MCP service provider listing in progress (the link goes here once it is live)

## Tools

| Tool | Price | What it returns |
|---|---|---|
| `catalog` | free | Supported symbols, token and wrapper addresses, venues, prices, networks |
| `session` | $0.005 | US equity session (regular / pre / after-hours / closed, NYSE holidays and early closes), what that means for the OKX price, issuer pause, scheduled multiplier changes, pool liquidity |
| `quote` | $0.01 | Fill for a buy or sell in USD or shares: amounts, average price per share, price impact, comparison with the OKX spot book. Refuses sizes the pool can't fill |
| `plan_trade` | $0.02 | Ordered unsigned transactions for X Layer mainnet: approvals, ERC-4626 wrap/unwrap, and a SwapRouter02 swap with slippage limits and a deadline |

REST paths: `/v1/catalog`, `/v1/session`, `/v1/quote`, `/v1/plan-trade` (GET with query parameters or POST with a JSON body).

## Two networks, on purpose

| What | Network |
|---|---|
| Market data, token metadata, Uniswap v3 pool state, trade calldata | **X Layer mainnet** (`eip155:196`) |
| x402 payments | **X Layer testnet** (`eip155:1952`), USD₮0 `0x9e29…fb0c` |

Real xStocks and real liquidity only exist on mainnet, so that is where every read and every generated transaction points. Payments settle on testnet so anyone can try the service with free faucet USD₮0 and nobody spends real money on a demo. Mainnet payments (`eip155:196`, USD₮0 `0x779d…3736`) are configured but disabled; switching is one environment variable. Every response says which network its data came from, and the catalog lists both.

## Paying

Payment is x402 v2, `exact` scheme: the buyer signs an EIP-3009 `transferWithAuthorization` for USD₮0 and the facilitator submits it. Any EOA can pay; no OKX account or hosted wallet is needed. Get testnet USD₮0 from the [X Layer faucet](https://web3.okx.com/xlayer/faucet/xlayerfaucet).

**REST.** OKX's `@okxweb3/app-x402-express` middleware. An unpaid call returns `402` with a `PAYMENT-REQUIRED` header; retry with `PAYMENT-SIGNATURE`; the receipt comes back in `PAYMENT-RESPONSE`. Input is validated before payment is requested, and the middleware settles only after a 2xx response, so a refused quote or plan is never charged.

**MCP.** An HTTP 402 can't gate individual tools behind a single JSON-RPC endpoint, so payment happens per tool call inside MCP:

- an unpaid call returns an `isError` result with the `PaymentRequired` object in `structuredContent` (and JSON-encoded in `content[0].text`);
- the client retries the same call with the signed payload in `_meta["x402/payment"]`;
- the settlement receipt comes back in the result's `_meta["x402/payment-response"]`.

This is the same wire format as Coinbase's [`@x402/mcp`](https://github.com/x402-foundation/x402), so `@x402/mcp` clients can pay Roundlot. We don't use that library on the server: it is built on Coinbase's `@x402/core` and calls resource-server methods that OKX's `@okxweb3/app-x402-core` doesn't have, and running both cores in one process would mean two x402 implementations verifying the same payments. The gate in [`service/src/mcp/paymentGate.ts`](service/src/mcp/paymentGate.ts) is about 80 lines on OKX's core, verifying and settling through the same facilitator as the REST routes. `catalog` is free and `initialize` / `tools/list` never ask for payment.

MCP clients that can't sign (for example Claude Desktop) get a readable "payment required" message with the price and the REST alternative.

## Try it

```bash
# Free
curl -s https://api.roundlot.0xo.in/v1/catalog | jq

# Paid, from a funded testnet key: pays session over REST and over MCP
cd service && DEMO_BUYER_PRIVATE_KEY=0x... BASE_URL=https://api.roundlot.0xo.in npx tsx scripts/spike.ts
```

MCP client config (streamable HTTP):

```json
{ "mcpServers": { "roundlot": { "type": "http", "url": "https://api.roundlot.0xo.in/mcp" } } }
```

## How the numbers are made

- **Only wrapped xStocks have liquidity.** On X Layer the usable Uniswap v3 pools pair the ERC-4626 wrappers (wNVDAx, wSPYx, wTSLAx) with USDG or USDC; every raw-token pool is empty. Quotes route through the wrapper and trade plans add the wrap or unwrap step.
- **Per-share normalisation.** xStocks carry a corporate-action multiplier (SPYx ≈ 1.0057), so one wrapped token is more than one share. Pool prices are divided by the wrapper's `convertToAssets` rate to get a per-share price that is comparable with OKX's `XNVDA-USDT` / `XSPY-USDT` / `XTSLA-USDT` books. Without this, SPY looks about 45 bps rich.
- **Pricing source.** Fills come from Uniswap's QuoterV2 on mainnet. A quote that would exhaust in-range liquidity is detected (the post-swap price hits the tick bound) and refused instead of returned as a partial fill.
- **Session.** xStocks trade 24/7 on OKX; outside US regular hours the price is last close plus a market estimate. `session` computes the NYSE session (holidays, early closes, DST) and says which regime a price belongs to.
- **Trade plans.** Exact-input or exact-output depending on the size unit; `amountOutMinimum` / `amountInMaximum` from `maxSlippageBps`; the swap is wrapped in `SwapRouter02.multicall(deadline, …)`. Existing allowances are skipped, low balances are flagged, and plans are refused when a multiplier change falls inside the deadline window.

## Architecture

```
            ┌─────────────── Roundlot service (Railway, Singapore) ───────────────┐
 agent ──▶  │  POST /mcp  ──▶ MCP server ─┐                                         │
            │                            ├─▶ tools: catalog · session · quote · plan_trade
 agent ──▶  │  /v1/*      ──▶ REST ───────┘        │                                │
            │        x402 gate (per tool / per route)                              │
            │              │ verify / settle                                        │
            └──────────────┼─────────────────────┼──────────────────────────────────┘
                           ▼                     ▼
                 facilitator (OKX or local)   X Layer mainnet RPC (Multicall3) · OKX public market data
                           │
                 X Layer testnet (USD₮0 transferWithAuthorization)
```

No database: market data is cached in memory (OKX books 2 s, pool state 2 s, token state 30 s), payment replay protection is the EIP-3009 nonce on-chain, and there are no accounts.

## Facilitator

`FACILITATOR=okx` (default) uses OKX's facilitator (`web3.okx.com`, verify/settle signed with Developer Portal credentials). `FACILITATOR=local` runs an in-process facilitator from OKX's SDK that verifies the signature and submits `transferWithAuthorization` from our own relayer key. `FACILITATOR=off` serves the free catalog only.

_Which facilitator served the demo, and why, is recorded here once the testnet run is complete._

## Run locally

```bash
npm ci
cp .env.example .env   # set PAY_TO and facilitator credentials
npm run dev -w service
```

Tests:

```bash
npm test -w service              # unit (NYSE calendar)
npm run test:live -w service     # live mainnet + OKX reads
npm run test:fork -w service     # executes plan_trade output on an anvil fork of X Layer (needs foundry)
```

## Repository

- `service/` — the API (Node 24, TypeScript, Express 5, MCP SDK, viem, OKX `app-x402-*` 0.2.0)
- `web/` — landing and docs page (Vercel), added later in the build
