import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BanIcon } from "lucide-react";

import { ProgramView } from "@/components/public/program-views";
import { publicWidgetQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/embed/$embedId")({
  validateSearch: (search: Record<string, unknown>) => ({
    theme:
      search.theme === "light" || search.theme === "dark" || search.theme === "auto"
        ? search.theme
        : undefined,
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicWidgetQuery(params.embedId)),
  component: EmbedRoute,
});

function EmbedRoute() {
  const { embedId } = Route.useParams();
  const { theme } = Route.useSearch();
  const result = useSuspenseQuery(publicWidgetQuery(embedId));
  if (!result.data.ok)
    return <p className="p-4 text-xs text-muted-foreground">This embed is unavailable.</p>;
  const { widget, program } = result.data.data;
  if (!widget.enabled)
    return (
      <main className="flex min-h-28 items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
        <BanIcon className="size-4" /> Embed disabled
      </main>
    );
  const resolvedTheme = theme ?? widget.options.theme;
  return (
    <main
      className={`embed-root min-h-svh bg-background p-3 text-foreground sm:p-4 ${resolvedTheme === "dark" ? "dark" : ""} ${resolvedTheme === "light" ? "light" : ""}`}
      style={
        widget.options.primaryColor === null
          ? undefined
          : ({
              "--primary": widget.options.primaryColor,
              "--ring": widget.options.primaryColor,
            } as React.CSSProperties)
      }
    >
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-tight">{program.event.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{widget.name}</p>
      </div>
      <ProgramView view={widget.view} program={program} options={widget.options} />
    </main>
  );
}
