import { notFound } from "next/navigation";
import { DocsPage } from "@/components/docs/page";
import { getDoc } from "@/lib/docs";
import { DOCS_ORDER } from "@/lib/docs-nav";
import { getSEOTags } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS_ORDER.filter((d) => d.slug !== "index").map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  return getSEOTags({ title: `${doc?.frontmatter.title ?? "Docs"} · Roundlot Docs`, description: doc?.frontmatter.description, canonicalUrlRelative: `/docs/${slug}` });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();
  return (
    <DocsPage slug={slug} toc={doc.toc} updated={doc.updated} {...doc.frontmatter}>
      {doc.content}
    </DocsPage>
  );
}
