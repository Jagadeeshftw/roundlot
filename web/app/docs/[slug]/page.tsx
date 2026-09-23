import { notFound } from "next/navigation";
import { DivideX } from "@/components/divide";
import { DocsLayout } from "@/components/docs-layout";
import { getDoc, getDocs } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDocs()).filter((d) => d.slug !== "index").map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  return getSEOTags({ title: `${doc?.frontmatter.title ?? "Docs"} · Roundlot docs`, description: doc?.frontmatter.description, canonicalUrlRelative: `/docs/${slug}` });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [doc, docs] = await Promise.all([getDoc(slug), getDocs()]);
  if (!doc) notFound();
  return (
    <>
      <DivideX />
      <DocsLayout docs={docs} current={slug} toc={doc.toc} {...doc.frontmatter}>
        {doc.content}
      </DocsLayout>
      <DivideX />
    </>
  );
}
