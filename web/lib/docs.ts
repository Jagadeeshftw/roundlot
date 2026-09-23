import { promises as fs } from "fs";
import path from "path";
import { compileMDX } from "next-mdx-remote/rsc";
import type { MDXComponents } from "mdx/types";
import React from "react";
import remarkGfm from "remark-gfm";

type FrontMatter = {
  title: string;
  description: string;
  group: string;
  order: number;
  price?: string;
};

export type DocMeta = FrontMatter & { slug: string };

const DIR = path.join(process.cwd(), "content/docs");
export const GROUPS = ["Start", "Paying", "Tools", "Reference"];

export const slugify = (text: string) =>
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

const components: MDXComponents = {
  h2: ({ children }) => React.createElement("h2", { id: slugify(text(children)), className: "scroll-mt-24" }, children),
  h3: ({ children }) => React.createElement("h3", { id: slugify(text(children)), className: "scroll-mt-24" }, children),
};

async function read(slug: string) {
  return fs.readFile(path.join(DIR, `${slug}.mdx`), "utf-8");
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
    components,
    options: { parseFrontmatter: true, mdxOptions: { remarkPlugins: [remarkGfm] } },
  });
  // Section headings for the "On this page" list.
  const toc = [...source.matchAll(/^##\s+(.+)$/gm)].map((m) => {
    const title = m[1]!.replace(/`/g, "").trim();
    return { title, id: slugify(title) };
  });
  return { content, frontmatter, toc };
}

export async function getDocs(): Promise<DocMeta[]> {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".mdx"));
  const docs = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.mdx$/, "");
      const { frontmatter } = await compileMDX<FrontMatter>({
        source: await read(slug),
        options: { parseFrontmatter: true },
      });
      return { slug, ...frontmatter };
    }),
  );
  return docs.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order);
}
