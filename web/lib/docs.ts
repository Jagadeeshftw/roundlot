import { promises as fs } from "fs";
import path from "path";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/docs/mdx";
import { DOCS_ORDER } from "./docs-nav";
import updated from "@/content/docs/_updated.json";

type FrontMatter = { title: string; description: string; price?: string };

const DIR = path.join(process.cwd(), "content/docs");

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`"'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const read = (slug: string) => fs.readFile(path.join(DIR, `${slug}.mdx`), "utf-8");

// Headings for "On this page": ## and ### outside code fences.
function headings(source: string) {
  const out: { title: string; id: string; depth: 2 | 3 }[] = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const m = /^(##|###)\s+(.+)$/.exec(line);
    if (m) {
      const title = m[2]!.replace(/`/g, "").trim();
      out.push({ title, id: slugify(title), depth: m[1] === "##" ? 2 : 3 });
    }
  }
  return out;
}

export async function getDoc(slug: string) {
  let source: string;
  try {
    source = await read(slug);
  } catch {
    return null;
  }
  const { content, frontmatter } = await compileMDX<FrontMatter>({
    source,
    components: mdxComponents,
    options: { parseFrontmatter: true, mdxOptions: { remarkPlugins: [remarkGfm] } },
  });
  return {
    content,
    frontmatter,
    toc: headings(source),
    updated: (updated as Record<string, string>)[slug],
  };
}

// Plain text of an MDX body for the search index: no code, tags or markdown.
function plain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchEntry {
  href: string;
  page: string;
  group: string;
  heading?: string;
  text: string;
}

// One entry per page (title and lead) and one per section heading.
export async function getSearchIndex(): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = [];
  for (const doc of DOCS_ORDER) {
    const raw = await read(doc.slug);
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
    const description = fm ? (/description:\s*"?(.*?)"?\s*$/m.exec(fm[1]!)?.[1] ?? "") : "";
    const body = fm ? raw.slice(fm[0].length) : raw;
    const href = doc.slug === "index" ? "/docs" : `/docs/${doc.slug}`;
    const parts = body.split(/^(?=##\s)/m);
    entries.push({ href, page: doc.title, group: doc.group, text: `${description} ${plain(parts[0] ?? "")}`.slice(0, 400) });
    for (const part of parts.slice(1)) {
      const title = /^##\s+(.+)$/m.exec(part)?.[1]?.replace(/`/g, "").trim();
      if (!title) continue;
      const text = plain(part.replace(/^##\s+.+$/m, ""));
      entries.push({ href: `${href}#${slugify(title)}`, page: doc.title, group: doc.group, heading: title, text: text.slice(0, 400) });
    }
  }
  return entries;
}
