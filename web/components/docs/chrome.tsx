"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import config from "@/config";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoSVG } from "@/components/logo";
import { DOCS_NAV, docHref } from "@/lib/docs-nav";
import type { SearchEntry } from "@/lib/docs";
import { cn } from "@/lib/utils";

const SearchIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("text-muted", open && "rotate-90")} aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const currentSlug = (pathname: string) => (pathname === "/docs" ? "index" : pathname.replace(/^\/docs\//, "").replace(/\/$/, ""));

// ── Sidebar ─────────────────────────────────────────────────────────────────

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const slug = currentSlug(usePathname());
  const activeGroup = DOCS_NAV.find((g) => g.items.some((i) => i.slug === slug))?.name;
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOCS_NAV.map((g) => [g.name, g.name === activeGroup])),
  );
  useEffect(() => {
    if (activeGroup) setOpen((o) => ({ ...o, [activeGroup]: true }));
  }, [activeGroup]);

  return (
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      {DOCS_NAV.map((g) => (
        <div key={g.name} className="flex flex-col">
          <button
            type="button"
            aria-expanded={!!open[g.name]}
            onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}
            className="flex min-h-9 cursor-pointer items-center justify-between rounded-md px-2 text-left text-xs font-semibold tracking-wide text-neutral-900 uppercase hover:bg-gray-100 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            {g.name}
            <Chevron open={!!open[g.name]} />
          </button>
          {open[g.name] && (
            <div className="border-divide mb-2 ml-2 flex flex-col border-l">
              {g.items.map((i) => {
                const active = i.slug === slug;
                return (
                  <Link
                    key={i.slug}
                    href={docHref(i.slug)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-ml-px border-l-2 py-1.5 pr-2 pl-3",
                      active
                        ? "border-brand text-brand font-medium"
                        : "text-muted border-transparent hover:text-neutral-900 dark:hover:text-neutral-100",
                      i.mono && "font-mono text-[13px]",
                    )}
                  >
                    {i.title}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

function snippet(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  const at = Math.max(0, Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0)) - 40);
  const s = text.slice(at, at + 140).trim();
  return (at > 0 ? "…" : "") + s + (at + 140 < text.length ? "…" : "");
}

export function search(index: SearchEntry[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = index
    .map((e, order) => {
      const title = (e.heading ?? e.page).toLowerCase();
      const hay = `${e.page} ${e.heading ?? ""} ${e.group} ${e.text}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return null;
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 10;
        if (title.startsWith(t)) score += 5;
        if (e.page.toLowerCase().includes(t)) score += 3;
      }
      if (!e.heading) score += 2;
      return { e, score, order, snip: snippet(e.text, terms) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 8);
}

export function SearchDialog({ index, open, onClose }: { index: SearchEntry[]; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const results = useMemo(() => search(index, query), [index, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setActive(0), [query]);

  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-neutral-900/35 px-3 pt-3 sm:pt-28 dark:bg-black/60" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search docs"
        onMouseDown={(e) => e.stopPropagation()}
        className="border-line w-full max-w-[640px] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-black"
      >
        <label className="border-line flex h-14 items-center gap-3 border-b px-4">
          <SearchIcon className="text-muted" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active].e.href);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search docs…"
            aria-label="Search docs"
            aria-controls="docs-search-results"
            aria-activedescendant={results[active] ? `docs-search-${active}` : undefined}
            className="h-full flex-1 bg-transparent text-base text-neutral-900 outline-none dark:text-neutral-100"
          />
          {query && <span className="text-muted text-xs">{results.length ? `${results.length} results` : "No results"}</span>}
        </label>
        <ul id="docs-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {!query && <li className="text-muted px-3 py-6 text-center text-sm">Search every docs page and section.</li>}
          {results.map((r, i) => (
            <li key={r.e.href} id={`docs-search-${i}`} role="option" aria-selected={i === active}>
              <a
                href={r.e.href}
                onMouseEnter={() => setActive(i)}
                onClick={(ev) => {
                  ev.preventDefault();
                  go(r.e.href);
                }}
                className={cn("flex flex-col gap-0.5 rounded-xl px-3 py-2.5", i === active && "bg-gray-100 dark:bg-neutral-900")}
              >
                <span className="text-muted text-xs">
                  {r.e.group}
                  {r.e.heading ? ` › ${r.e.page}` : ""}
                </span>
                <span className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{r.e.heading ?? r.e.page}</span>
                <span className="text-muted line-clamp-2 text-[13px] leading-snug">{r.snip}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="border-line text-muted hidden items-center gap-4 border-t px-4 py-2.5 text-xs sm:flex">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> Navigate</span>
          <span><Kbd>↵</Kbd> Open</span>
          <span><Kbd>esc</Kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="border-line rounded border px-1.5 py-px font-mono text-[11px]">{children}</kbd>
);

// ── Header ──────────────────────────────────────────────────────────────────

export function DocsHeader({ index }: { index: SearchEntry[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [mac, setMac] = useState(true);
  const pathname = usePathname();

  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  useEffect(() => setNavOpen(false), [pathname]);
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setSearchOpen((o) => !o);
    }
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);
  useEffect(() => {
    document.body.style.overflow = navOpen || searchOpen ? "hidden" : "";
  }, [navOpen, searchOpen]);

  const links = [
    { title: "API status", href: `${config.apiUrl}/health` },
    { title: "Catalog JSON", href: `${config.apiUrl}/v1/catalog` },
    { title: "GitHub", href: config.repoUrl },
  ];

  return (
    <>
      <header className="border-divide sticky top-0 z-50 border-b bg-white dark:bg-black">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-10">
          <button
            type="button"
            aria-label="Open docs navigation"
            onClick={() => setNavOpen(true)}
            className="-ml-3 flex size-11 items-center justify-center text-neutral-900 lg:hidden dark:text-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <Link href="/" aria-label="Roundlot home" className="flex shrink-0 items-center gap-2.5 text-neutral-900 lg:w-[264px] dark:text-neutral-100">
            <LogoSVG />
            <span className="text-lg font-medium">Roundlot</span>
            <span className="text-muted text-lg">Docs</span>
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search docs"
            className="border-line text-muted hidden h-10 max-w-[440px] flex-1 cursor-pointer items-center gap-2.5 rounded-full border bg-gray-100 pr-2 pl-3.5 text-sm md:flex dark:bg-neutral-950"
          >
            <SearchIcon />
            <span className="flex-1 text-left">Search docs…</span>
            <kbd className="border-line rounded-md border bg-white px-1.5 py-0.5 font-mono text-[11px] dark:bg-black">{mac ? "⌘ K" : "Ctrl K"}</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1 md:gap-6">
            {links.map((l) => (
              <a key={l.title} href={l.href} target="_blank" rel="noreferrer" className="text-muted hidden text-sm hover:text-neutral-900 xl:inline dark:hover:text-neutral-100">
                {l.title} <span aria-hidden="true">↗</span>
              </a>
            ))}
            <button
              type="button"
              aria-label="Search docs"
              onClick={() => setSearchOpen(true)}
              className="flex size-11 items-center justify-center text-neutral-900 md:hidden dark:text-neutral-100"
            >
              <SearchIcon />
            </button>
            <span className="[&_*]:transition-none">
              <ModeToggle />
            </span>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-[70] bg-neutral-900/35 lg:hidden dark:bg-black/60" onMouseDown={() => setNavOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Docs navigation"
            onMouseDown={(e) => e.stopPropagation()}
            className="border-divide h-full w-[300px] max-w-[85vw] overflow-y-auto border-r bg-white p-4 dark:bg-black"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Docs</span>
              <button type="button" aria-label="Close docs navigation" onClick={() => setNavOpen(false)} className="text-muted -mr-2 flex size-11 items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <DocsNav onNavigate={() => setNavOpen(false)} />
            <div className="border-divide mt-4 flex flex-col gap-2 border-t pt-4 text-sm">
              {links.map((l) => (
                <a key={l.title} href={l.href} target="_blank" rel="noreferrer" className="text-muted py-1">
                  {l.title} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      <SearchDialog index={index} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

// ── On this page ────────────────────────────────────────────────────────────

type TocItem = { title: string; id: string; depth: 2 | 3 };

function useActiveHeading(toc: TocItem[]) {
  const [active, setActive] = useState(toc[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      let current = toc[0]?.id;
      for (const h of toc) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= 120) current = h.id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = toc[toc.length - 1]?.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);
  return active;
}

export function OnThisPage({ toc }: { toc: TocItem[] }) {
  const active = useActiveHeading(toc);
  if (!toc.length) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col text-[13px]">
      <div className="text-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">On this page</div>
      <div className="border-divide flex flex-col border-l">
        {toc.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            aria-current={h.id === active ? "location" : undefined}
            className={cn(
              "-ml-px border-l-2 py-1.5",
              h.depth === 3 ? "pl-6" : "pl-3",
              h.id === active ? "border-brand text-brand font-medium" : "text-muted border-transparent hover:text-neutral-900 dark:hover:text-neutral-100",
            )}
          >
            {h.title}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function OnThisPageMobile({ toc }: { toc: TocItem[] }) {
  const [open, setOpen] = useState(false);
  if (!toc.length) return null;
  return (
    <div className="relative xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-line text-muted flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
        On this page
      </button>
      {open && (
        <div className="border-line absolute right-0 z-40 mt-2 w-64 rounded-xl border bg-white p-2 shadow-lg dark:bg-black">
          {toc.map((h) => (
            <a key={h.id} href={`#${h.id}`} onClick={() => setOpen(false)} className={cn("text-muted block rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-neutral-900", h.depth === 3 && "pl-5")}>
              {h.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
