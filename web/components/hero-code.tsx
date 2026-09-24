"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Container } from "./container";

// One real round trip, from a quote Roundlot returned for $1,000 of NVDA on
// 23 Sep 2026. Labelled as a sample: the numbers are not live.
const lines: { dir?: "out" | "in"; text: string; note?: string }[] = [
  { dir: "out", text: 'tools/call quote {"symbol":"NVDA","side":"buy","size":"1000"}' },
  { dir: "in", text: "payment required · $0.01 USD₮0 · eip155:1952" },
  { dir: "out", text: 'tools/call quote + _meta["x402/payment"]', note: "EIP-3009 signature" },
  { dir: "in", text: 'settled · receipt in _meta["x402/payment-response"]' },
  { text: "{" },
  { text: '  "fill": { "pay": "1000 USDG", "receive": "4.3672 shares (wNVDAx)",' },
  { text: '            "avgPricePerShare": 228.98, "priceImpactBps": 5.6 },' },
  { text: '  "reference": { "venue": "OKX spot", "onchainEdgeBps": 3.6 },' },
  { text: '  "data": { "network": "eip155:196" }' },
  { text: "}" },
];

export const HeroCode = () => {
  const reduce = useReducedMotion();
  return (
    <Container className="border-divide border-x bg-gray-100 px-4 py-6 md:px-12 md:py-12 dark:bg-neutral-950">
      <div className="shadow-aceternity mx-auto max-w-4xl overflow-hidden rounded-xl bg-white dark:bg-neutral-900">
        <div className="border-divide flex items-center gap-2 border-b px-4 py-3 font-mono text-xs text-gray-600 dark:text-neutral-400">
          <span className="bg-line size-2.5 rounded-full" />
          <span className="bg-line size-2.5 rounded-full" />
          <span className="bg-line size-2.5 rounded-full" />
          <span className="ml-2">agent ⇄ roundlot /mcp</span>
          <span className="border-line ml-auto rounded-full border px-2 py-0.5 text-[11px]">sample response</span>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-6 text-neutral-900 sm:p-5 sm:text-[13px] dark:text-neutral-100">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : 0.15 + i * 0.12 }}
              className="whitespace-pre"
            >
              {line.dir === "out" && <span className="text-gray-600 dark:text-neutral-400">→ </span>}
              {line.dir === "in" && <span className="text-brand">← </span>}
              <span className={line.dir === "in" ? "text-brand" : undefined}>{line.text}</span>
              {line.note && <span className="text-gray-600 dark:text-neutral-400">{`  (${line.note})`}</span>}
            </motion.div>
          ))}
        </pre>
      </div>
    </Container>
  );
};
