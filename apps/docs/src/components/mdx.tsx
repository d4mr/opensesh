import defaultMdxComponents from "fumadocs-ui/mdx";
import { APIPage, type ApiPageProps } from "fumadocs-openapi/ui";
import type { MDXComponents } from "mdx/types";
import { openapi } from "@/lib/openapi";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // Generated API reference pages render through this — the server
    // instance resolves the schema snapshot and shared render options.
    APIPage: (props: ApiPageProps) => <APIPage {...openapi.getAPIPageProps(props)} />,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
