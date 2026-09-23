import React from "react";
import Link from "next/link";
import { Container } from "./container";
import { GROUPS, type DocMeta } from "@/lib/docs";
import { cn } from "@/lib/utils";

const href = (slug: string) => (slug === "index" ? "/docs" : `/docs/${slug}`);

const Nav = ({ docs, current }: { docs: DocMeta[]; current: string }) => (
  <div className="flex flex-col gap-6 text-sm">
    {GROUPS.map((group) => (
      <div key={group} className="flex flex-col gap-1">
        <div className="text-muted px-2.5 pb-1.5 font-mono text-[11px] tracking-wider uppercase">{group}</div>
        {docs
          .filter((d) => d.group === group)
          .map((d) => (
            <Link
              key={d.slug}
              href={href(d.slug)}
              aria-current={d.slug === current ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5",
                d.slug === current
                  ? "bg-gray-100 font-medium text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-muted hover:text-neutral-900 dark:hover:text-neutral-100",
                group === "Tools" && "font-mono",
              )}
            >
              {d.title}
            </Link>
          ))}
      </div>
    ))}
  </div>
);

export const DocsLayout = ({
  docs,
  current,
  title,
  description,
  price,
  toc,
  children,
}: {
  docs: DocMeta[];
  current: string;
  title: string;
  description: string;
  price?: string;
  toc: { title: string; id: string }[];
  children: React.ReactNode;
}) => {
  const group = docs.find((d) => d.slug === current)?.group;
  return (
    <Container className="border-divide flex border-x">
      <aside aria-label="Docs sections" className="border-divide hidden w-60 shrink-0 border-r px-5 py-8 lg:block">
        <div className="sticky top-24">
          <Nav docs={docs} current={current} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 md:px-12 md:py-10">
        <details className="border-line mb-6 rounded-lg border lg:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium">Docs menu</summary>
          <div className="border-line border-t p-3">
            <Nav docs={docs} current={current} />
          </div>
        </details>
        <div className="text-muted font-mono text-xs">
          {group} / {title}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className={cn("text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-100", group === "Tools" && "font-mono")}>
            {title}
          </h1>
          {price && <span className="bg-brand-soft text-brand rounded-full px-3 py-1 text-sm">{price}</span>}
        </div>
        <p className="text-muted mt-4 max-w-2xl text-base leading-relaxed">{description}</p>
        <article className="prose prose-neutral dark:prose-invert prose-headings:font-medium prose-a:text-brand prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-pre:bg-gray-100 prose-pre:text-neutral-900 dark:prose-pre:bg-neutral-900 dark:prose-pre:text-neutral-100 prose-pre:border prose-pre:border-line mt-8 max-w-none">
          {children}
        </article>
      </main>

      {toc.length > 0 && (
        <aside aria-label="On this page" className="border-divide hidden w-52 shrink-0 border-l px-5 py-10 xl:block">
          <div className="sticky top-24 flex flex-col gap-2.5 text-sm">
            <div className="text-muted font-mono text-[11px] tracking-wider uppercase">On this page</div>
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="text-muted hover:text-neutral-900 dark:hover:text-neutral-100">
                {t.title}
              </a>
            ))}
          </div>
        </aside>
      )}
    </Container>
  );
};
