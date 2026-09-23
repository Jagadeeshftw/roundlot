import React from "react";
import Link from "next/link";
import config from "@/config";
import { Container } from "./container";
import { SectionHeading } from "./seciton-heading";
import { Button } from "./button";

export const CTA = () => {
  return (
    <Container className="border-divide relative flex min-h-60 flex-col items-center justify-center gap-6 overflow-hidden border-x bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] px-4 py-16 [background-size:10px_10px] md:min-h-96">
      <SectionHeading className="relative z-10 max-w-3xl text-center text-balance lg:text-5xl">
        Give your agent a market it can pay for
      </SectionHeading>
      <div className="relative z-10 flex flex-wrap justify-center gap-3">
        <Button as={Link} href="/docs/quickstart">
          Connect over MCP
        </Button>
        <Button as="a" href={config.repoUrl} variant="secondary">
          View on GitHub
        </Button>
      </div>
    </Container>
  );
};
