import type { XStock } from "../registry.js";
import { cache } from "./cache.js";
import { mainnet, wrapperAbi, xStockAbi } from "./chain.js";

const ONE = 10n ** 18n;

export interface TokenState {
  multiplier: bigint; // 1e18-scaled; raw balance = shares × multiplier
  pendingMultiplier: { value: bigint; activatesAt: number } | null;
  paused: boolean;
  // Raw xStock tokens (≈ shares of the underlying) per 1 wrapped token, 1e18-scaled.
  assetsPerWrapped: bigint;
  blockNumber: bigint;
}

export function getTokenState(x: XStock): Promise<TokenState> {
  return cache.get(`token:${x.symbol}`, 30_000, async () => {
    const [multiplier, newMultiplier, activation, paused, assetsPerWrapped, blockNumber] = await Promise.all([
      mainnet.readContract({ address: x.raw.address, abi: xStockAbi, functionName: "multiplier" }),
      mainnet.readContract({ address: x.raw.address, abi: xStockAbi, functionName: "newMultiplier" }),
      mainnet.readContract({ address: x.raw.address, abi: xStockAbi, functionName: "newMultiplierActivationTime" }),
      mainnet.readContract({ address: x.raw.address, abi: xStockAbi, functionName: "isPaused" }),
      mainnet.readContract({ address: x.wrapped.address, abi: wrapperAbi, functionName: "convertToAssets", args: [ONE] }),
      mainnet.getBlockNumber(),
    ]);
    const activatesAt = Number(activation);
    return {
      multiplier,
      pendingMultiplier: activatesAt > 0 ? { value: newMultiplier, activatesAt } : null,
      paused,
      assetsPerWrapped,
      blockNumber,
    };
  });
}

export const toFloat18 = (v: bigint) => Number(v) / 1e18;
