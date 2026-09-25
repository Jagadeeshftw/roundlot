import React from "react";
import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import { cn } from "@/lib/utils";
import { Pre, Tab, Tabs } from "./client";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`"'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const text = (node: React.ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(text).join("")
      : React.isValidElement<{ children?: React.ReactNode }>(node)
        ? text(node.props.children)
        : "";

const HINT = {
  info: {
    box: "bg-slate-100 border-slate-300 dark:bg-slate-900 dark:border-slate-700",
    icon: "text-slate-600 dark:text-slate-400",
    path: "M12 11v6M12 7.5v.5",
    label: "Info",
  },
  success: {
    box: "bg-brand-soft border-emerald-200 dark:border-emerald-800",
    icon: "text-brand",
    path: "M8 12.5l2.8 2.8L16 10",
    label: "Note",
  },
  warning: {
    box: "bg-amber-50 border-amber-300 dark:bg-[#2a1d05] dark:border-amber-800",
    icon: "text-amber-700 dark:text-amber-400",
    path: "M12 7.5v5.5M12 16.2v.3",
    label: "Warning",
  },
  danger: {
    box: "bg-red-50 border-red-300 dark:bg-[#2a0b0b] dark:border-red-900",
    icon: "text-red-700 dark:text-red-400",
    path: "M9 9l6 6M15 9l-6 6",
    label: "Danger",
  },
} as const;

export function Hint({
  type = "info",
  title,
  children,
}: {
  type?: keyof typeof HINT;
  title?: string;
  children: React.ReactNode;
}) {
  const h = HINT[type];
  return (
    <div role="note" aria-label={h.label} className={cn("not-prose my-5 flex gap-3 rounded-xl border px-4 py-3.5", h.box)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cn("mt-[3px] shrink-0", h.icon)} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d={h.path} />
      </svg>
      <div className="min-w-0 text-[15px] leading-relaxed text-neutral-900 dark:text-neutral-100 [&_a]:text-brand [&_a]:underline [&_code]:font-mono [&_code]:text-[13px] [&_code]:[overflow-wrap:anywhere] [&_p]:m-0 [&_p+p]:mt-2">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </div>
    </div>
  );
}

function heading(level: "h2" | "h3") {
  const Heading = ({ children }: { children?: React.ReactNode }) => {
    const id = slugify(text(children));
    const Tag = level;
    return (
      <Tag id={id} className="group scroll-mt-24">
        {children}
        <a href={`#${id}`} aria-label="Link to this section" className="text-muted ml-2 no-underline opacity-0 group-hover:opacity-100 focus:opacity-100">
          #
        </a>
      </Tag>
    );
  };
  return Heading;
}

function A({ href = "", children }: React.ComponentProps<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) return <Link href={href}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

// Wide tables scroll inside their own box instead of widening the page.
function Table(props: React.ComponentProps<"table">) {
  return (
    <div className="not-prose border-line my-5 overflow-x-auto rounded-xl border">
      <table {...props} className="w-full border-collapse text-left text-sm [&_code]:font-mono [&_code]:text-[13px] [&_td]:border-t [&_td]:border-divide [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td]:text-neutral-700 dark:[&_td]:text-neutral-300 [&_th]:bg-gray-100 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted dark:[&_th]:bg-neutral-950" />
    </div>
  );
}

export const mdxComponents: MDXComponents = {
  h2: heading("h2"),
  h3: heading("h3"),
  a: A,
  pre: Pre as MDXComponents["pre"],
  table: Table,
  Hint,
  Tabs,
  Tab,
};
