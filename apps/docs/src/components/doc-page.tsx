import { getPageImageUrl, getPageMarkdownUrl, source } from "@/lib/source";
import { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
} from "fumadocs-ui/layouts/docs/page";
import { unstable_notFound } from "waku/router/server";
import { getMDXComponents } from "@/components/mdx";

// Shared renderer for the root index (`/`) and every nested docs page —
// Waku's `[...slugs]` catch-all doesn't match the bare root route.
export function DocPage({ slugs }: { readonly slugs: ReadonlyArray<string> }) {
  const page = source.getPage([...slugs]);
  if (!page) unstable_notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  return (
    <DocsPage toc={page.data.toc}>
      <meta property="og:image" content={getPageImageUrl(page)} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}
