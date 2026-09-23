// xStocks supported by Roundlot on X Layer mainnet (196). Addresses verified
// on-chain 2026-09-23. Only the ERC-4626 wrapped tokens have usable Uniswap v3
// liquidity, so quotes and trade plans route through the wrapper.

export interface Stablecoin {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

export const STABLES = {
  USDG: { symbol: "USDG", address: "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8", decimals: 6 },
  USDC: { symbol: "USDC", address: "0xb6ceceab302e2e4948951ee7843fc24e92933061", decimals: 6 },
} as const satisfies Record<string, Stablecoin>;

export interface XStock {
  symbol: string;
  underlying: string;
  name: string;
  raw: { symbol: string; address: `0x${string}`; decimals: number };
  wrapped: { symbol: string; address: `0x${string}`; decimals: number };
  pool: { quote: Stablecoin; fee: number };
  okxInstId: string;
}

export const XSTOCKS: Record<string, XStock> = {
  NVDA: {
    symbol: "NVDA",
    underlying: "NVIDIA Corp.",
    name: "NVIDIA xStock",
    raw: { symbol: "NVDAx", address: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d", decimals: 18 },
    wrapped: { symbol: "wNVDAx", address: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5", decimals: 18 },
    pool: { quote: STABLES.USDG, fee: 500 },
    okxInstId: "XNVDA-USDT",
  },
  SPY: {
    symbol: "SPY",
    underlying: "SPDR S&P 500 ETF Trust",
    name: "SP500 xStock",
    raw: { symbol: "SPYx", address: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48", decimals: 18 },
    wrapped: { symbol: "wSPYx", address: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540", decimals: 18 },
    pool: { quote: STABLES.USDG, fee: 500 },
    okxInstId: "XSPY-USDT",
  },
  TSLA: {
    symbol: "TSLA",
    underlying: "Tesla, Inc.",
    name: "Tesla xStock",
    raw: { symbol: "TSLAx", address: "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0", decimals: 18 },
    wrapped: { symbol: "wTSLAx", address: "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171", decimals: 18 },
    pool: { quote: STABLES.USDC, fee: 500 },
    okxInstId: "XTSLA-USDT",
  },
};

export function resolveSymbol(input: string): XStock | undefined {
  const s = input.trim().toUpperCase().replace(/^W/, "").replace(/X$/, "");
  return XSTOCKS[s];
}
