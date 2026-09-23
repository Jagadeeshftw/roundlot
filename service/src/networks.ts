import type { Network } from "@okxweb3/app-x402-core/types";

// Roundlot reads market data from X Layer mainnet and takes payments on X Layer
// testnet. The two never mix: data always comes from DATA_NETWORK; payments go
// to whichever PAYMENT_NETWORKS entry is enabled.

export const DATA_NETWORK = {
  caip2: "eip155:196" as Network,
  chainId: 196,
  name: "X Layer mainnet",
  explorer: "https://web3.okx.com/explorer/x-layer",
  rpcUrls: ["https://xlayerrpc.okx.com", "https://rpc.xlayer.tech"],
} as const;

export interface PaymentNetwork {
  caip2: Network;
  chainId: number;
  name: string;
  enabled: boolean;
  explorer: string;
  rpcUrl: string;
  asset: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
    // EIP-712 domain; note the name uses U+20AE (₮), not a plain T.
    eip712: { name: string; version: string };
  };
}

export const PAYMENT_NETWORKS: Record<string, PaymentNetwork> = {
  "eip155:1952": {
    caip2: "eip155:1952",
    chainId: 1952,
    name: "X Layer testnet",
    enabled: true,
    explorer: "https://web3.okx.com/explorer/x-layer-testnet",
    rpcUrl: "https://testrpc.xlayer.tech",
    asset: {
      address: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
      symbol: "USD₮0",
      decimals: 6,
      eip712: { name: "USD₮0", version: "1" },
    },
  },
  // Present so switching to mainnet is a config change, deliberately disabled
  // for the hackathon: nobody should spend real money on a demo.
  "eip155:196": {
    caip2: "eip155:196",
    chainId: 196,
    name: "X Layer mainnet",
    enabled: false,
    explorer: "https://web3.okx.com/explorer/x-layer",
    rpcUrl: "https://xlayerrpc.okx.com",
    asset: {
      address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
      symbol: "USD₮0",
      decimals: 6,
      eip712: { name: "USD₮0", version: "1" },
    },
  },
};

export function paymentNetwork(caip2: string): PaymentNetwork {
  const net = PAYMENT_NETWORKS[caip2];
  if (!net) throw new Error(`Unknown payment network ${caip2}`);
  if (!net.enabled) throw new Error(`Payment network ${caip2} is disabled`);
  return net;
}

export const txUrl = (net: { explorer: string }, hash: string) => `${net.explorer}/tx/${hash}`;
