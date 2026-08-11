import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

// House pattern for full-page editors (forms, review rounds): a compact
// h-11 bar — parent surface as the back affordance, a divider, the
// record's identity stacked small, and the editor's actions on the right.
export function EditorHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  children,
}: {
  readonly backTo: ComponentProps<typeof Link>["to"];
  readonly backLabel: string;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Button asChild size="sm" variant="ghost" className="pressable -ml-1">
        <Link to={backTo}>
          <ArrowLeftIcon /> {backLabel}
        </Link>
      </Button>
      <div className="min-w-0 border-l pl-3">
        <span className="block truncate text-xs font-medium">{title}</span>
        {subtitle === undefined ? null : (
          <span className="block text-[11px] leading-3 text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </header>
  );
}
