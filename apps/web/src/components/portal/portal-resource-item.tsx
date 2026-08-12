import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { RichText } from "@/components/forms/rich-text";
import { cn } from "@/lib/utils";

export function PortalResourceItem({
  title,
  subtitle,
  body,
  open,
  onToggle,
  attachment,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly attachment?: ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/70",
          open && "bg-muted/30",
        )}
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? (
          <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight">
            {title || "Untitled resource"}
          </span>
          {subtitle === "" ? null : (
            <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {open ? (
        <div className="border-t bg-muted/10 px-4 py-5 sm:px-8">
          <div className="max-w-3xl">
            <RichText
              markdown={body}
              className="text-sm leading-6 text-muted-foreground [&_h2]:text-[15px] [&_h2]:leading-6 [&_h2]:text-foreground [&_h3]:text-[13px] [&_h3]:leading-5 [&_h3]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground"
              fallback={<p className="text-sm text-muted-foreground">No page content yet.</p>}
            />
            {attachment === undefined || attachment === null ? null : (
              <div className="mt-5 border-t pt-4">{attachment}</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
