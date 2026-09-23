import { x402Client } from "@okxweb3/app-x402-core/client";
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from "@okxweb3/app-x402-core/http";
import type { PaymentRequired, SettleResponse } from "@okxweb3/app-x402-core/types";
import { toClientEvmSigner } from "@okxweb3/app-x402-evm";
import { ExactEvmScheme } from "@okxweb3/app-x402-evm/exact/client";
import { createPublicClient, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PaymentNetwork } from "../networks.js";

// An x402 buyer backed by a plain private key: signs EIP-3009
// TransferWithAuthorization payloads. No OKX account or hosted wallet involved.
export function createBuyer(privateKey: `0x${string}`, net: PaymentNetwork) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ transport: http(net.rpcUrl) });
  const client = new x402Client().register(
    net.caip2,
    new ExactEvmScheme(toClientEvmSigner(account, publicClient as never)),
  );

  return {
    address: account.address,

    async balance(): Promise<bigint> {
      return publicClient.readContract({
        address: net.asset.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      });
    },

    createPayment(paymentRequired: PaymentRequired) {
      return client.createPaymentPayload(paymentRequired);
    },

    // GET/POST a REST resource, paying once if it answers 402.
    async fetchPaid(url: string, init: RequestInit = {}) {
      const first = await fetch(url, init);
      if (first.status !== 402) return { response: first, receipt: undefined as SettleResponse | undefined };
      const header = first.headers.get("PAYMENT-REQUIRED");
      if (!header) throw new Error(`402 from ${url} without PAYMENT-REQUIRED header`);
      const payload = await client.createPaymentPayload(decodePaymentRequiredHeader(header));
      const headers = new Headers(init.headers);
      headers.set("PAYMENT-SIGNATURE", encodePaymentSignatureHeader(payload));
      const paid = await fetch(url, { ...init, headers });
      const receiptHeader = paid.headers.get("PAYMENT-RESPONSE");
      return { response: paid, receipt: receiptHeader ? decodePaymentResponseHeader(receiptHeader) : undefined };
    },
  };
}
