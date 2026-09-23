import Link from "next/link";
import config from "@/config";
import { Container } from "./container";
import { Logo } from "./logo";

const links = [
  { title: "Docs", href: "/docs" },
  { title: "Quickstart", href: "/docs/quickstart" },
  { title: "Catalog (JSON)", href: `${config.apiUrl}/v1/catalog` },
  { title: "GitHub", href: config.repoUrl },
];

export const Footer = () => {
  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col gap-6 px-4 py-12 md:flex-row md:items-start md:justify-between md:px-10">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo />
          <p className="text-muted text-sm leading-relaxed">
            Pay-per-call market data and trade plans for tokenized equities on X
            Layer. Built for OKX Dev Day 2026.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {links.map((l) => (
            <Link key={l.title} href={l.href} className="text-footer-link hover:text-neutral-900 dark:hover:text-neutral-100">
              {l.title}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-divide text-muted border-t px-4 py-5 text-xs md:px-10">
        Payments settle on X Layer testnet. Data and trade plans are X Layer mainnet. Not investment advice.
      </div>
    </Container>
  );
};
