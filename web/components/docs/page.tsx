import Link from "next/link";
import { DOCS_ORDER, docHref, neighbours } from "@/lib/docs-nav";
import { OnThisPage, OnThisPageMobile } from "./chrome";
import { cn } from "@/lib/utils";

type Toc = { title: string; id: string; depth: 2 | 3 }[];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export function DocsPage({
  slug,
  title,
  description,
  price,
  toc,
  updated,
  children,
}: {
  slug: string;
  title: string;
  description: string;
  price?: string;
  toc: Toc;
  updated?: string;
  children: React.ReactNode;
}) {
  const meta = DOCS_ORDER.find((d) => d.slug === slug);
  const { prev, next } = neighbours(slug);
  const date = fmtDate(updated);
  return (
    <>
      <div id="content" className="min-w-0 flex-1 py-6 lg:px-12 lg:py-7">
        <div className="flex items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="text-muted flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
            <Link href="/docs" className="hover:text-neutral-900 dark:hover:text-neutral-100">Docs</Link>
            <span aria-hidden="true">›</span>
            <span>{meta?.group}</span>
            <span aria-hidden="true">›</span>
            <span className={cn("text-neutral-900 dark:text-neutral-100", meta?.mono && "font-mono")}>{title}</span>
          </nav>
          <OnThisPageMobile toc={toc} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className={cn("text-[32px] leading-tight font-medium tracking-tight text-neutral-900 md:text-[40px] dark:text-neutral-100", meta?.mono && "font-mono")}>
            {title}
          </h1>
          {price && <span className="bg-brand-soft text-brand rounded-full px-2.5 py-1 text-[13px] font-medium">{price}</span>}
        </div>
        <p className="text-muted mt-3.5 max-w-[720px] text-[17px] leading-relaxed md:text-[19px]">{description}</p>

        <article className="prose prose-neutral dark:prose-invert prose-headings:font-medium prose-headings:tracking-tight prose-h2:mt-11 prose-h2:text-2xl prose-h3:text-lg prose-a:text-brand prose-a:font-normal prose-code:font-mono prose-code:font-normal prose-code:text-[0.87em] prose-code:before:content-none prose-code:after:content-none prose-li:my-1 mt-8 max-w-[760px] [&_code]:[overflow-wrap:anywhere]">
          {children}
        </article>

        {date && <p className="text-muted mt-12 text-[13px]">Last updated {date}</p>}
        <nav aria-label="Previous and next pages" className="mt-4 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
          {prev ? (
            <Link href={docHref(prev.slug)} className="border-line hover:border-brand flex flex-col gap-1 rounded-xl border px-4.5 py-4">
              <span className="text-muted text-xs">← Previous</span>
              <span className={cn("text-base font-medium text-neutral-900 dark:text-neutral-100", prev.mono && "font-mono")}>{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link href={docHref(next.slug)} className="border-line hover:border-brand flex flex-col items-end gap-1 rounded-xl border px-4.5 py-4 text-right">
              <span className="text-muted text-xs">Next →</span>
              <span className={cn("text-base font-medium text-neutral-900 dark:text-neutral-100", next.mono && "font-mono")}>{next.title}</span>
            </Link>
          )}
        </nav>
      </div>
      <aside className="hidden w-[224px] shrink-0 xl:block">
        <div className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col gap-5 overflow-y-auto py-10 pl-8">
          <OnThisPage toc={toc} />
          <div className="flex flex-col gap-2 text-[13px]">
            <a href={`https://github.com/Jagadeeshftw/roundlot/blob/main/web/content/docs/${slug}.mdx`} target="_blank" rel="noreferrer" className="text-muted hover:text-neutral-900 dark:hover:text-neutral-100">
              Edit on GitHub ↗
            </a>
            <a href="#" className="text-muted hover:text-neutral-900 dark:hover:text-neutral-100">Back to top ↑</a>
          </div>
        </div>
      </aside>
    </>
  );
}
