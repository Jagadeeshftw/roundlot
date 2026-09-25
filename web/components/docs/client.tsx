"use client";
import React, { Children, createContext, isValidElement, useContext, useRef, useState } from "react";

const InTabs = createContext(false);
import { cn } from "@/lib/utils";

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

export function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={`${label} code`}
      className="text-muted flex min-h-9 cursor-pointer items-center gap-1.5 px-2 text-xs hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      <CopyIcon />
      {copied ? "Copied" : label}
    </button>
  );
}

const LANG_LABEL: Record<string, string> = {
  bash: "Shell",
  sh: "Shell",
  json: "JSON",
  ts: "TypeScript",
  typescript: "TypeScript",
  js: "JavaScript",
  http: "HTTP",
  text: "Text",
};

// Fenced code block: a title bar with the language (or a given title) and a
// copy button. Inside <Tabs>, the tab bar replaces the title bar.
export function Pre(props: React.ComponentProps<"pre"> & { "data-title"?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const inTabs = useContext(InTabs);
  const child = Children.toArray(props.children).find(isValidElement);
  const lang = isValidElement<{ className?: string }>(child)
    ? /language-(\w+)/.exec(child.props.className ?? "")?.[1]
    : undefined;
  const title = props["data-title"] ?? (lang ? (LANG_LABEL[lang] ?? lang) : "Code");
  const pre = (
    <pre
      ref={ref}
      className={cn(
        "m-0 overflow-x-auto bg-transparent p-4 font-mono text-[13px] leading-6 text-neutral-900 dark:text-neutral-100",
        inTabs && "pr-24",
      )}
    >
      {props.children}
    </pre>
  );
  if (inTabs) {
    return (
      <div className="not-prose relative">
        <div className="absolute top-1 right-1">
          <CopyButton getText={() => ref.current?.innerText ?? ""} />
        </div>
        {pre}
      </div>
    );
  }
  return (
    <div className="not-prose border-line my-5 overflow-hidden rounded-xl border bg-gray-100 dark:bg-neutral-950">
      <div className="border-line text-muted flex min-h-10 items-center justify-between border-b pr-1 pl-4 text-xs">
        <span className="font-mono">{title}</span>
        <CopyButton getText={() => ref.current?.innerText ?? ""} />
      </div>
      {pre}
    </div>
  );
}

// Content tabs: <Tabs><Tab label="curl">…</Tab><Tab label="MCP">…</Tab></Tabs>.
export function Tabs({ children }: { children: React.ReactNode }) {
  const tabs = Children.toArray(children).filter(isValidElement) as React.ReactElement<{
    label: string;
    children: React.ReactNode;
  }>[];
  const [active, setActive] = useState(0);
  return (
    <div className="not-prose border-line my-5 overflow-hidden rounded-xl border bg-gray-100 dark:bg-neutral-950">
      <div role="tablist" className="border-line flex overflow-x-auto border-b">
        {tabs.map((t, i) => (
          <button
            key={t.props.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "min-h-10 cursor-pointer border-b-2 px-4 text-[13px] whitespace-nowrap",
              i === active
                ? "border-brand font-medium text-neutral-900 dark:text-neutral-100"
                : "text-muted border-transparent hover:text-neutral-900 dark:hover:text-neutral-100",
            )}
          >
            {t.props.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200 [&>p]:m-0 [&>p]:px-4 [&>p]:py-3.5 [&_code]:font-mono [&_code]:text-[13px]">
        <InTabs.Provider value={true}>{tabs[active]?.props.children}</InTabs.Provider>
      </div>
    </div>
  );
}

export function Tab({ children }: { label: string; children: React.ReactNode }) {
  return <>{children}</>;
}
