import { notFound } from "next/navigation";
import { DivideX } from "@/components/divide";
import { DocsLayout } from "@/components/docs-layout";
import { getDoc, getDocs } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

export async function generateMetadata() {
  const doc = await getDoc("index");
  return getSEOTags({ title: `${doc?.frontmatter.title ?? "Docs"} · Roundlot docs`, description: doc?.frontmatter.description, canonicalUrlRelative: "/docs" });
}

export default async function DocsIndex() {
  const [doc, docs] = await Promise.all([getDoc("index"), getDocs()]);
  if (!doc) notFound();
  return (
    <>
      <DivideX />
      <DocsLayout docs={docs} current="index" toc={doc.toc} {...doc.frontmatter}>
        {doc.content}
      </DocsLayout>
      <DivideX />
    </>
  );
}
