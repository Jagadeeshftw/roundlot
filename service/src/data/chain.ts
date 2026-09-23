import { createPublicClient, fallback, http, parseAbi } from "viem";
import { xLayer } from "viem/chains";
import { DATA_NETWORK } from "../networks.js";

// X Layer mainnet reader. Calls are batched through Multicall3; the fallback
// transport moves to the next RPC on errors or 429s. DATA_RPC_URLS overrides
// the endpoints (comma-separated), e.g. to point tests at a local fork.
const rpcUrls = process.env.DATA_RPC_URLS?.split(",").map((u) => u.trim()).filter(Boolean) ?? DATA_NETWORK.rpcUrls;

export const mainnet = createPublicClient({
  chain: xLayer,
  batch: { multicall: { wait: 10 } },
  transport: fallback(
    rpcUrls.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
    { rank: false },
  ),
});

export const UNISWAP = {
  factory: "0x4B2ab38DBF28D31D467aA8993f6c2585981D6804",
  quoterV2: "0xd1b797d92d87b688193a2b976efc8d577d204343",
  swapRouter02: "0x4f0c28f5926afda16bf2506d5d9e57ea190f9bca",
} as const;

// TickMath bounds; QuoterV2 swaps to these when sqrtPriceLimitX96 = 0, so a
// quote that ends exactly here ran out of liquidity (partial fill).
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

export const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

export const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// SwapRouter02 (IV3SwapRouter): the single-hop structs have no deadline field;
// the deadline is enforced by wrapping calls in multicall(uint256, bytes[]).
export const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

// Backed xStock token (BackedAutoFeeTokenImplementation). balanceOf already
// includes the multiplier; one token unit ≈ one underlying share.
export const xStockAbi = parseAbi([
  "function multiplier() view returns (uint256)",
  "function newMultiplier() view returns (uint256)",
  "function newMultiplierActivationTime() view returns (uint256)",
  "function isPaused() view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// ERC-4626 wrapper (WrappedBackedTokenImplementation): shares are wrapped
// tokens, assets are raw xStock tokens.
export const wrapperAbi = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function previewMint(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);
