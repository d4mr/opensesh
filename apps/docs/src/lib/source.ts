import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { openapi } from "./openapi";
import { docsContentRoute, docsImageRoute, docsRoute } from "./shared";
import { defineDocs } from "fumadocs-mdx/macro";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// The API reference is generated as virtual pages straight from the OpenAPI
// snapshot — no MDX files on disk (mirrors fumadocs.dev's own setup).
export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: "api/(generated)",
      meta: { folderStyle: "separator" },
      groupBy: "tag",
    }),
  },
  {
    baseUrl: docsRoute,
    plugins: [lucideIconsPlugin(), openapi.loaderPlugin()],
  },
);

export type Page = NonNullable<ReturnType<(typeof source)["getPage"]>>;

export function getPageImageUrl(page: Page) {
  const segments = [...page.slugs, "image.webp"];

  return "/" + [page.locale, ...docsImageRoute.split("/"), ...segments].filter(Boolean).join("/");
}

export function getPageMarkdownUrl(page: Page) {
  const segments = [...page.slugs, "content.md"];

  return {
    segments,
    url: "/" + [page.locale, ...docsContentRoute.split("/"), ...segments].filter(Boolean).join("/"),
  };
}

export async function getLLMText(page: Page) {
  if (page.type === "openapi") {
    return `# ${page.data.title} (${page.url})

${page.data.description ?? ""}`;
  }

  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})

${processed}`;
}
