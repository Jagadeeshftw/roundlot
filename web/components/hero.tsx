import React from "react";
import Link from "next/link";
import { Container } from "./container";
import { Heading } from "./heading";
import { SubHeading } from "./subheading";
import { Button } from "./button";
import { Badge } from "./badge";

export const Hero = () => {
  return (
    <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-14 pb-12 md:pt-28 md:pb-20">
      <Badge text="x402 · MCP · X Layer" />
      <Heading className="mt-4 max-w-4xl">
        Pay-per-call market data for{" "}
        <span className="text-brand">tokenized equities</span>
      </Heading>

      <SubHeading as="p" className="text-muted mx-auto mt-6 max-w-xl">
        An MCP server and REST API for NVDA, SPY and TSLA xStocks on X Layer.
        Quotes against live Uniswap v3 liquidity, market-session checks and
        unsigned trade plans, each paid per call with x402. No account needed.
      </SubHeading>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button as={Link} href="/docs/quickstart">
          Connect over MCP
        </Button>
        <Button variant="secondary" as={Link} href="/docs">
          Read the docs
        </Button>
      </div>
      <div className="text-muted mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 font-mono text-xs sm:text-sm">
        <span>catalog free</span>
        <span>session $0.005</span>
        <span>quote $0.01</span>
        <span>plan_trade $0.02</span>
      </div>
    </Container>
  );
};
