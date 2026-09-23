import { z } from "zod";
import { paymentNetwork, type PaymentNetwork } from "./networks.js";

const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected a 0x address");
const hexKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected a 0x private key");

const Env = z
  .object({
    PORT: z.coerce.number().int().default(3000),
    PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
    PAYMENT_NETWORK: z.string().default("eip155:1952"),
    PAY_TO: hexAddress,
    // "okx" = OKX facilitator (verify/settle via web3.okx.com, HMAC-signed with
    // Dev Portal credentials). "local" = in-process facilitator that verifies the
    // EIP-3009 authorization and submits it on-chain from RELAYER_PRIVATE_KEY.
    // "off" = catalog only; paid tools answer "payments unavailable".
    FACILITATOR: z.enum(["okx", "local", "off"]).default("okx"),
    OKX_API_KEY: z.string().optional(),
    OKX_SECRET_KEY: z.string().optional(),
    OKX_PASSPHRASE: z.string().optional(),
    OKX_BASE_URL: z.string().url().default("https://web3.okx.com"),
    RELAYER_PRIVATE_KEY: hexKey.optional(),
    // Overrides the payment network RPC (e.g. a local fork for tests).
    PAYMENT_RPC_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.FACILITATOR === "okx") {
      for (const k of ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when FACILITATOR=okx" });
      }
    }
    if (env.FACILITATOR === "local" && !env.RELAYER_PRIVATE_KEY) {
      ctx.addIssue({ code: "custom", path: ["RELAYER_PRIVATE_KEY"], message: "required when FACILITATOR=local" });
    }
  });

export type Config = z.infer<typeof Env> & { payment: PaymentNetwork };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const payment = paymentNetwork(parsed.data.PAYMENT_NETWORK);
  return {
    ...parsed.data,
    payment: parsed.data.PAYMENT_RPC_URL ? { ...payment, rpcUrl: parsed.data.PAYMENT_RPC_URL } : payment,
  };
}
