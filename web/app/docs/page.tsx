import { notFound } from "next/navigation";
import { DocsPage } from "@/components/docs/page";
import { getDoc } from "@/lib/docs";
import { getSEOTags } from "@/lib/seo";

export async function generateMetadata() {
  const doc = await getDoc("index");
  return getSEOTags({ title: `${doc?.frontmatter.title ?? "Docs"} · Roundlot Docs`, description: doc?.frontmatter.description, canonicalUrlRelative: "/docs" });
}

export default async function DocsIndex() {
  const doc = await getDoc("index");
  if (!doc) notFound();
  return (
    <DocsPage slug="index" toc={doc.toc} updated={doc.updated} {...doc.frontmatter}>
      {doc.content}
    </DocsPage>
  );
}
