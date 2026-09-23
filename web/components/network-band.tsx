import React from "react";
import { Container } from "./container";

export const NetworkBand = () => {
  return (
    <Container className="border-divide divide-divide grid grid-cols-1 divide-y border-x md:grid-cols-2 md:divide-x md:divide-y-0">
      <div className="flex flex-col gap-2 px-4 py-7 md:px-10">
        <div className="text-muted font-mono text-xs">DATA · eip155:196</div>
        <div className="text-lg font-medium text-neutral-900 dark:text-neutral-100">X Layer mainnet</div>
        <p className="text-muted text-sm leading-relaxed">
          Real xStocks and real liquidity live here, so every read and every
          generated transaction points at mainnet.
        </p>
      </div>
      <div className="flex flex-col gap-2 px-4 py-7 md:px-10">
        <div className="text-brand font-mono text-xs">PAYMENTS · eip155:1952</div>
        <div className="text-lg font-medium text-neutral-900 dark:text-neutral-100">X Layer testnet, USD₮0</div>
        <p className="text-muted text-sm leading-relaxed">
          Try it with free faucet USD₮0. Nobody spends real money on a demo;
          mainnet payments are configured and switched off.
        </p>
      </div>
    </Container>
  );
};
