const config = {
  websiteName: "Roundlot: pay-per-call xStock data for AI agents",
  websiteUrl: process.env.NEXT_PUBLIC_WEBSITE_URL || "https://roundlot.0xo.in",
  websiteDescription:
    "An MCP server and REST API for NVDA, SPY and TSLA xStocks on X Layer: quotes against live Uniswap v3 liquidity, market-session checks and unsigned trade plans, each paid per call with x402.",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "https://api-production-86c9.up.railway.app",
  repoUrl: "https://github.com/Jagadeeshftw/roundlot",
};

export default config;
