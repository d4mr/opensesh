import type { ContentDiffRow } from "@/lib/content-diff";
import { cn } from "@/lib/utils";

export function ChangeDiff({
  rows,
  className,
}: {
  readonly rows: ReadonlyArray<ContentDiffRow>;
  readonly className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      {rows.map((row) => (
        <div key={row.key} className="grid min-w-0 gap-1 text-xs">
          <p className="font-medium capitalize text-muted-foreground">{row.label}</p>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2">
              {row.before}
            </pre>
            <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2">
              {row.after}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}
