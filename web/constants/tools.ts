export const tools = [
  {
    name: "catalog",
    price: "Free",
    unit: "",
    line: "What Roundlot covers and what each tool costs.",
    items: [
      "NVDA, SPY and TSLA xStocks",
      "Token and ERC-4626 wrapper addresses",
      "Uniswap v3 venue, OKX reference market",
      "Data vs payment network",
    ],
  },
  {
    name: "session",
    price: "$0.005",
    unit: "per call",
    line: "Is the US market open, and what that means for the price.",
    items: [
      "NYSE phase, next open and close",
      "Holidays and early closes",
      "OKX pricing regime off-hours",
      "Issuer pause, multiplier changes",
    ],
  },
  {
    name: "quote",
    price: "$0.01",
    unit: "per call",
    featured: true,
    line: "The fill for a buy or sell against live liquidity.",
    items: [
      "Size in USD or shares",
      "Average price per share",
      "Price impact vs the pool mid",
      "Edge vs crossing the OKX book",
    ],
  },
  {
    name: "plan_trade",
    price: "$0.02",
    unit: "per call",
    line: "Ordered, unsigned transactions to execute it.",
    items: [
      "Approve, wrap, swap, unwrap",
      "Slippage limits and a deadline",
      "Skips approvals you already gave",
      "You sign; Roundlot holds nothing",
    ],
  },
];

export const facts = [
  {
    title: "Only wrapped xStocks trade",
    body: "On X Layer the liquid Uniswap v3 pools pair the ERC-4626 wrappers with USDG or USDC. Quotes route through the wrapper; plans add the wrap or unwrap step.",
  },
  {
    title: "Per-share, not per-token",
    body: "A wrapped token carries a corporate-action multiplier, so pool prices are divided by the wrapper rate before they are compared with OKX. Without it, SPY looks 45 bps rich.",
  },
  {
    title: "No partial fills dressed up as quotes",
    body: "If a size would run the pool out of in-range liquidity, the quote is refused and nothing is charged.",
  },
  {
    title: "Prices have a regime",
    body: "xStocks trade around the clock; outside US hours the price is last close plus an estimate. session says which one you are looking at.",
  },
];
