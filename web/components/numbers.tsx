import React from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { facts } from "@/constants/tools";

export const Numbers = () => {
  return (
    <Container className="border-divide flex flex-col items-center border-x pt-16">
      <Badge text="Under the hood" />
      <SectionHeading className="mt-4">How the numbers are made</SectionHeading>
      <div className="border-divide divide-divide mt-12 grid w-full grid-cols-1 border-t md:grid-cols-2">
        {facts.map((f, i) => (
          <div
            key={f.title}
            className={`border-divide flex flex-col gap-2 border-b px-4 py-7 md:px-10 ${i % 2 === 0 ? "md:border-r" : ""}`}
          >
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{f.title}</h3>
            <p className="text-muted text-sm leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </Container>
  );
};
