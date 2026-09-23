import { OKXFacilitatorClient } from "@okxweb3/app-x402-core";
import { x402Facilitator } from "@okxweb3/app-x402-core/facilitator";
import type { FacilitatorClient } from "@okxweb3/app-x402-core/server";
import type { SupportedResponse } from "@okxweb3/app-x402-core/types";
import { toFacilitatorEvmSigner } from "@okxweb3/app-x402-evm";
import { registerExactEvmScheme } from "@okxweb3/app-x402-evm/exact/facilitator";
import { createWalletClient, defineChain, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../config.js";

export interface SelectedFacilitator {
  kind: "okx" | "local";
  client: FacilitatorClient;
  // Who submits the settlement transaction on-chain (relayer address for "local").
  settler: string;
}

export function createFacilitator(cfg: Config): SelectedFacilitator {
  if (cfg.FACILITATOR === "okx") {
    return {
      kind: "okx",
      client: new OKXFacilitatorClient({
        apiKey: cfg.OKX_API_KEY!,
        secretKey: cfg.OKX_SECRET_KEY!,
        passphrase: cfg.OKX_PASSPHRASE!,
        baseUrl: cfg.OKX_BASE_URL,
      }),
      settler: "OKX facilitator (web3.okx.com)",
    };
  }
  return createLocalFacilitator(cfg);
}

// Self-hosted facilitator: verifies the buyer's EIP-3009 signature and submits
// transferWithAuthorization from our own relayer, which pays the gas.
function createLocalFacilitator(cfg: Config): SelectedFacilitator {
  const account = privateKeyToAccount(cfg.RELAYER_PRIVATE_KEY as `0x${string}`);
  const chain = defineChain({
    id: cfg.payment.chainId,
    name: cfg.payment.name,
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: { default: { http: [cfg.payment.rpcUrl] } },
  });
  const wallet = createWalletClient({ account, chain, transport: http(cfg.payment.rpcUrl) }).extend(publicActions);

  const facilitator = new x402Facilitator();
  registerExactEvmScheme(facilitator, {
    networks: cfg.payment.caip2,
    signer: toFacilitatorEvmSigner({
      address: account.address,
      readContract: (args) => wallet.readContract(args as never),
      verifyTypedData: (args) => wallet.verifyTypedData(args as never),
      writeContract: (args) => wallet.writeContract(args as never),
      sendTransaction: (args) => wallet.sendTransaction(args),
      waitForTransactionReceipt: (args) => wallet.waitForTransactionReceipt(args),
      getCode: (args) => wallet.getCode(args),
    }),
  });

  const client: FacilitatorClient = {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    getSupported: async () => facilitator.getSupported() as SupportedResponse,
  };
  return { kind: "local", client, settler: account.address };
}
