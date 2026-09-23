export const faqs = [
  {
    question: "Do I need an OKX account?",
    answer:
      "No. Any wallet that can sign an EIP-3009 authorization can pay. Testnet USD₮0 comes from the X Layer faucet.",
  },
  {
    question: "Why are payments on testnet?",
    answer:
      "So anyone can try every tool without spending real money. The data and the trade plans are real X Layer mainnet; mainnet payments are configured and switched off.",
  },
  {
    question: "Does Roundlot hold keys or funds?",
    answer:
      "No. plan_trade returns unsigned transactions for your account to sign and send. The only thing Roundlot receives is the per-call payment.",
  },
  {
    question: "What if a call fails?",
    answer:
      "Payment settles only after the tool succeeds. A refused quote or plan, such as a size the pool can't fill, is never charged.",
  },
  {
    question: "Which MCP clients can pay?",
    answer:
      "Any client that speaks the @x402/mcp convention: it reads the payment requirements from the tool result and retries with the signed payload in _meta. Clients that can't sign get a readable price and the REST alternative.",
  },
];
