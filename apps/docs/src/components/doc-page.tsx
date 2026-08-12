import { getPageImageUrl, getPageMarkdownUrl, source, type Page } from "@/lib/source";
import { appName, siteUrl } from "@/lib/shared";
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
import { OpenAPIPage } from "@/components/openapi-page";

// React 19 hoists these into <head>. Every page (MDX and OpenAPI) gets a
// title, description, and absolute OG/twitter card pointing at the takumi
// image the /og route pre-renders for it.
function PageMeta({ page }: { readonly page: Page }) {
  const title = page.slugs.length === 0 ? appName : `${page.data.title} — ${appName}`;
  const description = page.data.description;
  const url = siteUrl + page.url;
  const image = siteUrl + getPageImageUrl(page);
  return (
    <>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:site_name" content={appName} />
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content="article" />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={image} />
    </>
  );
}

// Shared renderer for the root index (`/`) and every nested docs page —
// Waku's `[...slugs]` catch-all doesn't match the bare root route.
export function DocPage({ slugs }: { readonly slugs: ReadonlyArray<string> }) {
  const page = source.getPage([...slugs]);
  if (!page) unstable_notFound();

  // API reference pages are virtual (no MDX) — rendered fully by <OpenAPIPage>,
  // same template fumadocs.dev uses for its own OpenAPI demo.
  if (page.type === "openapi") {
    return (
      <DocsPage full>
        <PageMeta page={page} />
        <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
        <DocsBody>
          <OpenAPIPage {...page.data.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  return (
    <DocsPage toc={page.data.toc}>
      <PageMeta page={page} />
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
