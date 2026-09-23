"use client";
import React, { useState } from "react";
import config from "@/config";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type TryResponse = {
  result?: unknown;
  receipt?: unknown;
  settlement?: { transaction: string; explorer: string } | null;
  error?: string;
  message?: string;
};

const TABS = ["result", "receipt"] as const;

// The demo wallet pays for one real quote; the page shows what came back.
export const TryIt = () => {
  const [symbol, setSymbol] = useState("NVDA");
  const [state, setState] = useState<"idle" | "paying" | "done" | "error">("idle");
  const [data, setData] = useState<TryResponse | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("result");

  const run = async () => {
    setState("paying");
    setData(null);
    try {
      const res = await fetch(`${config.apiUrl}/v1/try`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const body = (await res.json()) as TryResponse;
      setData(body);
      setState(res.ok ? "done" : "error");
    } catch {
      setData({ error: "network", message: "Couldn't reach the Roundlot API." });
      setState("error");
    }
  };

  const shown = tab === "result" ? data?.result : data?.receipt;

  return (
    <Container id="try" className="border-divide grid scroll-mt-20 grid-cols-1 gap-10 border-x px-4 py-16 md:grid-cols-2 md:px-10">
      <div className="flex flex-col items-start gap-4">
        <Badge text="Try it" />
        <SectionHeading className="text-left">Watch one paid call happen</SectionHeading>
        <p className="text-muted text-base leading-relaxed">
          Our demo wallet pays $0.01 in testnet USD₮0 for a real quote of $100 of
          the stock you pick. You see the tool result, the payment receipt and the
          settlement on the X Layer testnet explorer.
        </p>
        <p className="text-muted text-sm">Three tries per visitor per hour. Testnet only.</p>
        <fieldset className="mt-2 flex gap-2">
          <legend className="sr-only">Stock</legend>
          {["NVDA", "SPY", "TSLA"].map((s) => (
            <label
              key={s}
              className={cn(
                "border-line flex min-h-11 cursor-pointer items-center rounded-lg border px-4 font-mono text-sm",
                symbol === s && "border-brand text-brand",
              )}
            >
              <input type="radio" name="symbol" value={s} checked={symbol === s} onChange={() => setSymbol(s)} className="sr-only" />
              {s}
            </label>
          ))}
        </fieldset>
        <Button variant="brand" onClick={run} disabled={state === "paying"} className="min-h-11 disabled:opacity-60">
          {state === "paying" ? "Paying and quoting…" : `Pay $0.01 and quote ${symbol}`}
        </Button>
      </div>

      <div className="border-line self-start overflow-hidden rounded-xl border bg-white font-mono text-xs dark:bg-neutral-950">
        <div role="tablist" className="border-line flex border-b">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "min-h-11 cursor-pointer px-4",
                tab === t ? "border-brand border-b-2 text-neutral-900 dark:text-neutral-100" : "text-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <pre className="h-72 overflow-auto p-4 leading-6 whitespace-pre-wrap text-neutral-900 dark:text-neutral-100">
          {state === "idle" && <span className="text-muted">Press the button to pay for one quote.</span>}
          {state === "paying" && <span className="text-muted">Signing the x402 payment and waiting for settlement…</span>}
          {(state === "done" || state === "error") &&
            JSON.stringify(state === "error" ? { error: data?.error, message: data?.message } : shown, null, 2)}
        </pre>
        <div className="border-line text-muted flex min-h-11 flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
          <span>{data?.settlement ? "PAYMENT-RESPONSE · success" : "settlement"}</span>
          {data?.settlement && (
            <a href={data.settlement.explorer} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              {data.settlement.transaction.slice(0, 10)}… on explorer ↗
            </a>
          )}
        </div>
      </div>
    </Container>
  );
};
