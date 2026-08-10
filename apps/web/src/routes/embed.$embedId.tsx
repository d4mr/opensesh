import { filterPublicSessions, type WidgetOptions, type WidgetView } from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BanIcon } from "lucide-react";

import { ProgramView } from "@/components/public/program-views";
import { publicWidgetQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/embed/$embedId")({
  validateSearch: parseWidgetSearch,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicWidgetQuery(params.embedId)),
  component: EmbedRoute,
});

function EmbedRoute() {
  const { embedId } = Route.useParams();
  const search = Route.useSearch();
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
  const options: WidgetOptions = {
    ...widget.options,
    ...(search.tracks === undefined ? {} : { trackIds: search.tracks }),
    ...(search.formats === undefined ? {} : { formatIds: search.formats }),
    ...(search.tags === undefined ? {} : { tagIds: search.tags }),
    ...(search.theme === undefined ? {} : { theme: search.theme }),
    ...(search.color === undefined ? {} : { primaryColor: search.color }),
    ...(search.time === undefined ? {} : { dateFormat: search.time }),
    ...(search.company === undefined ? {} : { showSpeakerCompany: search.company }),
    ...(search.title === undefined ? {} : { showSpeakerTitle: search.title }),
    ...(search.bio === undefined ? {} : { showSpeakerBio: search.bio }),
    ...(search.description === undefined ? {} : { showSessionDescription: search.description }),
    ...(search.level === undefined ? {} : { showSessionLevel: search.level }),
    ...(search.format === undefined ? {} : { showSessionFormat: search.format }),
    ...(search.calendar === undefined ? {} : { showAddToCalendar: search.calendar }),
  };
  const displayProgram =
    search.days === undefined
      ? program
      : {
          ...program,
          sessions: filterPublicSessions(program.sessions, {
            timezone: program.event.timezone,
            dayKeys: search.days,
          }),
        };
  const resolvedTheme = options.theme;
  return (
    <main
      className={`embed-root min-h-svh bg-background p-3 text-foreground sm:p-4 ${resolvedTheme === "dark" ? "dark" : ""} ${resolvedTheme === "light" ? "light" : ""}`}
      style={
        options.primaryColor === null
          ? undefined
          : ({
              "--primary": options.primaryColor,
              "--ring": options.primaryColor,
            } as React.CSSProperties)
      }
    >
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-tight">{program.event.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{widget.name}</p>
      </div>
      <ProgramView view={search.view ?? widget.view} program={displayProgram} options={options} />
    </main>
  );
}

const widgetView = (value: unknown): WidgetView | undefined =>
  value === "sessions" ||
  value === "speakers" ||
  value === "speaker_gallery" ||
  value === "agenda" ||
  value === "itinerary"
    ? value
    : undefined;
const bool = (value: unknown) => (value === "1" ? true : value === "0" ? false : undefined);
const csv = (value: unknown) =>
  typeof value === "string" ? value.split(",").filter((item) => item !== "") : undefined;

interface WidgetSearch {
  readonly view?: WidgetView;
  readonly theme?: "light" | "dark" | "auto";
  readonly color?: string | null;
  readonly time?: "12h" | "24h";
  readonly tracks?: ReadonlyArray<string>;
  readonly formats?: ReadonlyArray<string>;
  readonly days?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly company?: boolean;
  readonly title?: boolean;
  readonly bio?: boolean;
  readonly description?: boolean;
  readonly level?: boolean;
  readonly format?: boolean;
  readonly calendar?: boolean;
}

function parseWidgetSearch(search: Record<string, unknown>): WidgetSearch {
  return {
    view: widgetView(search.view),
    theme:
      search.theme === "light" || search.theme === "dark" || search.theme === "auto"
        ? search.theme
        : undefined,
    color:
      search.color === "default"
        ? null
        : typeof search.color === "string" && /^#[\da-f]{6}$/i.test(search.color)
          ? search.color
          : undefined,
    time: search.time === "24h" || search.time === "12h" ? search.time : undefined,
    tracks: csv(search.tracks),
    formats: csv(search.formats),
    days: csv(search.days),
    tags: csv(search.tags),
    company: bool(search.company),
    title: bool(search.title),
    bio: bool(search.bio),
    description: bool(search.description),
    level: bool(search.level),
    format: bool(search.format),
    calendar: bool(search.calendar),
  };
}
