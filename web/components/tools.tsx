import React from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";
import { tools } from "@/constants/tools";
import { cn } from "@/lib/utils";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-brand mt-0.5 shrink-0" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Tools = () => {
  return (
    <Container id="tools" className="border-divide flex scroll-mt-20 flex-col items-center border-x pt-16">
      <Badge text="Tools" />
      <SectionHeading className="mt-4">Four tools, priced per call</SectionHeading>
      <SubHeading as="p" className="text-muted mx-auto mt-6 max-w-lg px-4">
        Same tools over MCP and REST. Refused calls are never charged.
      </SubHeading>
      <div className="border-divide divide-divide mt-12 grid w-full grid-cols-1 divide-y border-t sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className={cn(
              "flex flex-col gap-4 px-4 py-7 md:px-6",
              tool.featured && "bg-gray-100 dark:bg-neutral-900",
            )}
          >
            <div className="font-mono text-[15px] text-neutral-900 dark:text-neutral-100">{tool.name}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-medium text-neutral-900 dark:text-neutral-100">{tool.price}</span>
              {tool.unit && <span className="text-muted text-sm">{tool.unit}</span>}
            </div>
            <p className="text-muted min-h-10 text-sm leading-relaxed">{tool.line}</p>
            <div className="bg-divide h-px" />
            <ul className="flex flex-col gap-3">
              {tool.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-neutral-900 dark:text-neutral-100">
                  <Check />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Container>
  );
};
