"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// The x402 round trip, one row per message. Rows up to the active step are lit.
const rows = [
  { step: 0, route: "agent → roundlot", msg: 'tools/call quote {symbol:"NVDA"}' },
  { step: 1, route: "roundlot → agent", msg: "payment required · $0.01 · eip155:1952" },
  { step: 2, route: "agent → roundlot", msg: '_meta["x402/payment"] = signed authorization' },
  { step: 3, route: "roundlot → facilitator", msg: "verify, then settle after the tool succeeds" },
  { step: 3, route: "roundlot → agent", msg: 'result + _meta["x402/payment-response"]' },
];

export const SequencePanel = ({ activeStep }: { activeStep: number }) => {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full w-full items-center justify-center p-6 md:p-8">
      <div className="flex w-full max-w-md flex-col gap-2.5 font-mono text-xs">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border-line rounded-lg border bg-white px-1 py-2.5 dark:bg-black">agent</div>
          <div className="border-brand text-brand rounded-lg border bg-white px-1 py-2.5 dark:bg-black">roundlot</div>
          <div className="border-line rounded-lg border bg-white px-1 py-2.5 dark:bg-black">facilitator</div>
        </div>
        {rows.map((row, i) => {
          const lit = row.step <= activeStep;
          return (
            <motion.div
              key={i}
              initial={false}
              animate={{ opacity: lit ? 1 : 0.35 }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : lit ? i * 0.08 : 0 }}
              className={cn(
                "border-line flex flex-col gap-1 rounded-lg border bg-white px-3 py-2 dark:bg-black",
                row.step === activeStep && "border-brand",
              )}
            >
              <span className="text-muted">{row.route}</span>
              <span className="text-neutral-900 dark:text-neutral-100">{row.msg}</span>
            </motion.div>
          );
        })}
        <div
          className={cn(
            "rounded-lg px-3 py-2 transition-opacity duration-300",
            activeStep >= 3 ? "bg-brand-soft text-brand opacity-100" : "text-muted opacity-40",
          )}
        >
          settled on X Layer testnet · tx link in the receipt
        </div>
      </div>
    </div>
  );
};
