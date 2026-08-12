import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { OgImage } from "@/components/og-image";
import { appName } from "@/lib/shared";
import { source } from "@/lib/source";
import { ImageResponse } from "takumi-js/response";
import { Renderer } from "takumi-js/node";
import { ApiContext } from "waku/router";

// This route is static-rendered: it only ever runs in Node at build time (the
// deploy ships dist/public as plain assets), so reading the font off disk and
// using the native renderer are both safe.
let rendererPromise: Promise<Renderer> | undefined;
function brandRenderer() {
  rendererPromise ??= (async () => {
    const renderer = new Renderer();
    const manrope = createRequire(import.meta.url).resolve(
      "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
    );
    await renderer.registerFont({ name: "Manrope", data: await readFile(manrope) });
    return renderer;
  })();
  return rendererPromise;
}

export async function GET(_: Request, { params }: ApiContext<"/og/docs/[...slugs]/image.webp">) {
  const page = source.getPage(params.slugs);

  if (!page) return new Response(undefined, { status: 404 });

  return new ImageResponse(
    <OgImage title={page.data.title ?? appName} description={page.data.description} />,
    {
      width: 1200,
      height: 630,
      format: "webp",
      renderer: await brandRenderer(),
    },
  );
}

export async function getConfig() {
  const pages = source
    .generateParams()
    .map((item) => (item.lang ? [item.lang, ...item.slug] : item.slug));

  return {
    render: "static" as const,
    staticPaths: pages,
  } as const;
}
