import { BaseError, ContractFunctionRevertedError, zeroAddress } from "viem";
import type { XStock } from "../registry.js";
import { cache } from "./cache.js";
import { factoryAbi, MAX_SQRT_RATIO, MIN_SQRT_RATIO, mainnet, poolAbi, quoterAbi, UNISWAP } from "./chain.js";

export interface PoolState {
  address: `0x${string}`;
  fee: number;
  wrappedIsToken0: boolean;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  // Quote stablecoin per 1 wrapped token at the pool's current price.
  stablePerWrapped: number;
}

// Pool addresses come from the factory rather than a hardcoded list.
function resolvePool(x: XStock): Promise<`0x${string}`> {
  return cache.get(`pool:addr:${x.symbol}`, 24 * 3600_000, async () => {
    const addr = await mainnet.readContract({
      address: UNISWAP.factory,
      abi: factoryAbi,
      functionName: "getPool",
      args: [x.wrapped.address, x.pool.quote.address, x.pool.fee],
    });
    if (addr === zeroAddress) throw new Error(`No Uniswap v3 pool for ${x.wrapped.symbol}/${x.pool.quote.symbol}`);
    return addr;
  });
}

export function getPoolState(x: XStock): Promise<PoolState> {
  return cache.get(`pool:state:${x.symbol}`, 2_000, async () => {
    const address = await resolvePool(x);
    const [slot0, liquidity, token0] = await Promise.all([
      mainnet.readContract({ address, abi: poolAbi, functionName: "slot0" }),
      mainnet.readContract({ address, abi: poolAbi, functionName: "liquidity" }),
      mainnet.readContract({ address, abi: poolAbi, functionName: "token0" }),
    ]);
    const [sqrtPriceX96, tick] = slot0;
    const wrappedIsToken0 = token0.toLowerCase() === x.wrapped.address.toLowerCase();
    const d0 = wrappedIsToken0 ? x.wrapped.decimals : x.pool.quote.decimals;
    const d1 = wrappedIsToken0 ? x.pool.quote.decimals : x.wrapped.decimals;
    const p = (Number(sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (d0 - d1); // token0 priced in token1
    return {
      address,
      fee: x.pool.fee,
      wrappedIsToken0,
      sqrtPriceX96,
      tick,
      liquidity,
      stablePerWrapped: wrappedIsToken0 ? p : 1 / p,
    };
  });
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  gasEstimate: bigint;
  // True when the swap would exhaust in-range liquidity before completing.
  partial: boolean;
}

const hitBound = (sqrt: bigint) => sqrt <= MIN_SQRT_RATIO + 1n || sqrt >= MAX_SQRT_RATIO - 1n;

export async function quoteExactIn(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
  amountIn: bigint,
): Promise<SwapQuote> {
  const { result } = await mainnet.simulateContract({
    address: UNISWAP.quoterV2,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
  });
  const [amountOut, sqrtPriceX96After, , gasEstimate] = result;
  return { amountIn, amountOut, sqrtPriceX96After, gasEstimate, partial: hitBound(sqrtPriceX96After) };
}

export async function quoteExactOut(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  fee: number,
  amountOut: bigint,
): Promise<SwapQuote> {
  try {
    const { result } = await mainnet.simulateContract({
      address: UNISWAP.quoterV2,
      abi: quoterAbi,
      functionName: "quoteExactOutputSingle",
      args: [{ tokenIn, tokenOut, amount: amountOut, fee, sqrtPriceLimitX96: 0n }],
    });
    const [amountIn, sqrtPriceX96After, , gasEstimate] = result;
    return { amountIn, amountOut, sqrtPriceX96After, gasEstimate, partial: hitBound(sqrtPriceX96After) };
  } catch (err) {
    // QuoterV2 reverts when an exact-output amount can't be filled in full;
    // anything else (RPC failure) is a real error.
    const reverted = err instanceof BaseError && err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (!reverted) throw err;
    return { amountIn: 0n, amountOut, sqrtPriceX96After: 0n, gasEstimate: 0n, partial: true };
  }
}
