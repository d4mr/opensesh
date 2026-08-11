import { hasRichText, markdownToHtml } from "@opensesh/domain";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The one place stored rich text (markdown) becomes DOM. Every surface that
// displays a rich-text value renders through here so the markdown renderer,
// styling (.rte-content), and empty handling stay uniform.
export function RichText({
  markdown,
  className,
  fallback = null,
}: {
  readonly markdown: string | null | undefined;
  readonly className?: string;
  readonly fallback?: ReactNode;
}) {
  if (!hasRichText(markdown)) return fallback;
  return (
    <div
      className={cn("rte-content", className)}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
    />
  );
}
