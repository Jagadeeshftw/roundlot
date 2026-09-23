import React from "react";
import config from "@/config";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { CodeBlock } from "./code-block";

export const Connect = () => {
  const mcp = `{ "mcpServers": { "roundlot": {
  "type": "http",
  "url": "${config.apiUrl}/mcp"
} } }`;
  const curl = `# free
curl -X POST ${config.apiUrl}/v1/catalog

# paid: answers 402 with PAYMENT-REQUIRED
curl -i "${config.apiUrl}/v1/quote?symbol=NVDA&side=buy&size=100"`;
  return (
    <Container id="connect" className="border-divide flex scroll-mt-20 flex-col border-x px-4 py-16 md:px-10">
      <div className="flex flex-col items-center">
        <Badge text="Connect" />
        <SectionHeading className="mt-4">One URL for MCP, plain HTTP for the rest</SectionHeading>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CodeBlock title="mcp config" code={mcp} />
        <CodeBlock title="curl" code={curl} />
      </div>
    </Container>
  );
};
