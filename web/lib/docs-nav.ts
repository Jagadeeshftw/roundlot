// The one source of the docs order: the sidebar, Previous / Next and search
// all read it. Slugs are flat so every existing /docs/<slug> URL keeps working.

export interface NavItem {
  slug: string; // "index" is /docs
  title: string;
  mono?: boolean; // tool names render in the mono face
}

export interface NavGroup {
  name: string;
  items: NavItem[];
}

export const DOCS_NAV: NavGroup[] = [
  {
    name: "Getting started",
    items: [
      { slug: "index", title: "Overview" },
      { slug: "quickstart", title: "Quickstart" },
      { slug: "try-it", title: "Try it in the browser" },
    ],
  },
  {
    name: "Concepts",
    items: [
      { slug: "x402", title: "How x402 payments work" },
      { slug: "networks", title: "Networks" },
      { slug: "facilitators", title: "Facilitators" },
      { slug: "xstocks", title: "xStocks explained" },
      { slug: "prices", title: "How prices are made" },
      { slug: "market-sessions", title: "Market sessions" },
    ],
  },
  {
    name: "Paying",
    items: [
      { slug: "paying-rest", title: "x402 over REST" },
      { slug: "paying-mcp", title: "x402 over MCP" },
      { slug: "pay-agentic-wallet", title: "Pay with OKX Agentic Wallet" },
      { slug: "pay-okx-cli", title: "Pay with the OKX CLI" },
      { slug: "pay-from-code", title: "Pay from code" },
    ],
  },
  {
    name: "Tools",
    items: [
      { slug: "catalog", title: "catalog", mono: true },
      { slug: "session", title: "session", mono: true },
      { slug: "quote", title: "quote", mono: true },
      { slug: "plan-trade", title: "plan_trade", mono: true },
    ],
  },
  {
    name: "Guides",
    items: [
      { slug: "build-an-agent", title: "Build an agent that trades xStocks" },
      { slug: "executing-plans", title: "Executing a plan safely" },
    ],
  },
  {
    name: "OKX.AI",
    items: [{ slug: "okx-ai", title: "Roundlot on OKX.AI" }],
  },
  {
    name: "Reference",
    items: [
      { slug: "endpoints", title: "Endpoints" },
      { slug: "errors", title: "Errors and limits" },
      { slug: "assets", title: "Supported assets and contracts" },
      { slug: "security", title: "Security and trust" },
      { slug: "faq", title: "FAQ" },
      { slug: "changelog", title: "Changelog" },
    ],
  },
];

export const DOCS_ORDER: (NavItem & { group: string })[] = DOCS_NAV.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.name })),
);

export const docHref = (slug: string) => (slug === "index" ? "/docs" : `/docs/${slug}`);

export function neighbours(slug: string) {
  const i = DOCS_ORDER.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? DOCS_ORDER[i - 1] : undefined, next: i >= 0 ? DOCS_ORDER[i + 1] : undefined };
}
