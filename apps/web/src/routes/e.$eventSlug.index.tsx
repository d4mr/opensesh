import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDaysIcon, MapPinIcon, SquareStackIcon, UsersIcon } from "lucide-react";

import { publicProgramQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/e/$eventSlug/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProgramQuery(params.eventSlug)),
  component: PublicEventIndex,
});

function PublicEventIndex() {
  const { eventSlug } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  const { event, sessions } = program.data.data;
  const speakerCount = new Set(
    sessions.flatMap((session) => session.speakers.map((speaker) => speaker.id)),
  ).size;
  const dates = formatRange(event.startsAt, event.endsAt, event.timezone);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{event.tagline ?? event.name}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDaysIcon className="size-3.5" /> {dates}
        </span>
        {event.location === null ? null : (
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" /> {event.location}
          </span>
        )}
      </p>
      {event.description === null ? null : (
        <div
          className="rte-content mt-4 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      )}
      {sessions.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          The program is still being finalized — sessions and speakers will appear here as they are
          confirmed.
        </p>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link
            to="/e/$eventSlug/sessions"
            params={{ eventSlug }}
            search={{ q: undefined, track: undefined, format: undefined, room: undefined }}
            className="pressable rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <SquareStackIcon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-lg font-semibold tabular-nums">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </Link>
          <Link
            to="/e/$eventSlug/speakers"
            params={{ eventSlug }}
            search={{ q: undefined }}
            className="pressable rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <UsersIcon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-lg font-semibold tabular-nums">{speakerCount}</p>
            <p className="text-xs text-muted-foreground">Speakers</p>
          </Link>
          <Link
            to="/e/$eventSlug/agenda"
            params={{ eventSlug }}
            className="pressable rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <CalendarDaysIcon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-lg font-semibold">
              {event.agendaPublishedAt === null ? "Soon" : "Live"}
            </p>
            <p className="text-xs text-muted-foreground">Agenda</p>
          </Link>
        </div>
      )}
    </main>
  );
}

// Format in the event's timezone so SSR and the browser agree.
const formatRange = (startsAt: string, endsAt: string, timezone: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: timezone });
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone });
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: timezone });
  return `${month.format(start)} ${day.format(start)}–${day.format(end)}, ${year.format(end)}`;
};
