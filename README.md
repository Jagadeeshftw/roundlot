# Roundlot

Pay-per-call market data and trade planning for tokenized equities (xStocks) on X Layer, built for AI agents. Roundlot is an MCP server (streamable HTTP) and a REST API; paid tools are gated with [x402](https://github.com/okx/payments).

> Work in progress for OKX Dev Day 2026. This README will describe the finished service.

## Networks

| What | Network |
|---|---|
| Market data, token metadata, Uniswap v3 pool state, trade calldata | X Layer mainnet (`eip155:196`) |
| x402 payments | X Layer testnet (`eip155:1952`), USD₮0 |

Payments settle on testnet on purpose, so nobody spends real money trying the demo. Mainnet payments are configured but disabled.
