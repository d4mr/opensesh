import { filterPublicSessions, type WidgetOptions, type WidgetView } from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BanIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ProgramView } from "@/components/public/program-views";
import {
  publicWidgetQuery,
  WIDGET_PREVIEW_MESSAGE,
  WIDGET_PREVIEW_READY_MESSAGE,
} from "@/lib/widget-queries";

export const Route = createFileRoute("/embed/$embedId")({
  validateSearch: parseWidgetSearch,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicWidgetQuery(params.embedId)),
  component: EmbedRoute,
});

interface PreviewDraft {
  readonly view: WidgetView | undefined;
  readonly name: string | undefined;
  readonly options: Partial<WidgetOptions>;
}

function EmbedRoute() {
  const { embedId } = Route.useParams();
  const search = Route.useSearch();
  const result = useSuspenseQuery(publicWidgetQuery(embedId));
  // In builder preview mode (?preview=1) the widget editor pushes its live
  // draft into this document via postMessage, so the preview tracks unsaved
  // edits without reloading the iframe or waiting for the autosave.
  const [preview, setPreview] = useState<PreviewDraft | null>(null);
  const isPreview = search.preview === true;
  useEffect(() => {
    if (!isPreview) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: unknown;
        view?: unknown;
        name?: unknown;
        options?: unknown;
      } | null;
      if (data === null || data.type !== WIDGET_PREVIEW_MESSAGE) return;
      if (typeof data.options !== "object" || data.options === null) return;
      setPreview({
        view: widgetView(data.view),
        name: typeof data.name === "string" ? data.name : undefined,
        options: data.options as Partial<WidgetOptions>,
      });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: WIDGET_PREVIEW_READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [isPreview]);
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
    ...(preview === null ? {} : preview.options),
    ...(search.tracks === undefined ? {} : { trackIds: search.tracks }),
    ...(search.days === undefined ? {} : { dayKeys: search.days }),
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
    options.dayKeys.length === 0
      ? program
      : {
          ...program,
          sessions: filterPublicSessions(program.sessions, {
            timezone: program.event.timezone,
            dayKeys: options.dayKeys,
          }),
        };
  const resolvedTheme = options.theme;
  const customCss = options.customCss ?? "";
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
      {customCss.trim() === "" ? null : (
        <style
          data-custom-css
          // Neutralize </style so the sheet cannot break out of its tag; the
          // CSS itself is scoped to this document (the embed iframe).
          dangerouslySetInnerHTML={{ __html: customCss.replaceAll(/<\/(style)/gi, "<\\/$1") }}
        />
      )}
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-tight">{program.event.name}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{preview?.name ?? widget.name}</p>
      </div>
      <ProgramView
        view={preview?.view ?? search.view ?? widget.view}
        program={displayProgram}
        options={options}
      />
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
// The router re-serializes validated search back into the URL (arrays as
// JSON, "0"/"1" as numbers) and re-validates it, so each parser must accept
// both the raw form the widget builder emits and its own round-tripped
// output — otherwise the value degrades to undefined on the second pass and
// the preview override silently falls back to the widget's saved options.
const bool = (value: unknown) =>
  value === "1" || value === 1 || value === true
    ? true
    : value === "0" || value === 0 || value === false
      ? false
      : undefined;
const csv = (value: unknown) =>
  typeof value === "string"
    ? value.split(",").filter((item) => item !== "")
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : undefined;

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
  readonly preview?: boolean;
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
    preview: bool(search.preview),
  };
}
