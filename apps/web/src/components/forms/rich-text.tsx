import { freeformToHtml, hasRichText, markdownToHtml } from "@opensesh/domain";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The one place stored rich text (markdown) becomes DOM. Every surface that
// displays a rich-text value renders through here so the markdown renderer,
// styling (.rte-content), and empty handling stay uniform. `freeform` uses
// the outreach renderer (soft line breaks, auto-linked URLs) — pick it when
// previewing organizer-typed email bodies so the preview matches the send.
export function RichText({
  markdown,
  className,
  fallback = null,
  freeform = false,
}: {
  readonly markdown: string | null | undefined;
  readonly className?: string;
  readonly fallback?: ReactNode;
  readonly freeform?: boolean;
}) {
  if (!hasRichText(markdown)) return fallback;
  return (
    <div
      className={cn("rte-content", className)}
      dangerouslySetInnerHTML={{
        __html: freeform ? freeformToHtml(markdown) : markdownToHtml(markdown),
      }}
    />
  );
}
