"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export const CodeBlock = ({ title, code, className }: { title: string; code: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={cn("border-line overflow-hidden rounded-xl border bg-white dark:bg-neutral-950", className)}>
      <div className="border-line text-muted flex items-center justify-between border-b px-4 py-1.5 font-mono text-xs">
        <span>{title}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${title}`}
          className="min-h-9 cursor-pointer px-1 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-neutral-900 dark:text-neutral-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};
