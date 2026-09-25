import { DocsHeader, DocsNav } from "@/components/docs/chrome";
import { getSearchIndex } from "@/lib/docs";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const index = await getSearchIndex();
  return (
    <>
      <DocsHeader index={index} />
      <div className="mx-auto flex max-w-[1440px] px-4 md:px-10">
        <aside aria-label="Docs sections" className="hidden w-[264px] shrink-0 lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-7 pr-6">
            <DocsNav />
          </div>
        </aside>
        {children}
      </div>
    </>
  );
}
