import { PageProps } from "waku/router";
import { source } from "@/lib/source";
import { DocPage } from "@/components/doc-page";

export default function Page({ slugs }: PageProps<"/[...slugs]">) {
  return <DocPage slugs={slugs} />;
}

export async function getConfig() {
  const pages = source
    .generateParams()
    .map((item) => (item.lang ? [item.lang, ...item.slug] : item.slug))
    // The root index renders from pages/index.tsx, not the catch-all.
    .filter((slug) => slug.length > 0);

  return {
    render: "static" as const,
    staticPaths: pages,
  } as const;
}
