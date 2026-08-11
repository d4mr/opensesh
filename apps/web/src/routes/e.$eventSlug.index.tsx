import { publicSpeakerName } from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
  SquareStackIcon,
  UsersIcon,
} from "lucide-react";

import { RichText } from "@/components/forms/rich-text";
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
  const { event, sessions, tracks } = program.data.data;
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
      <RichText markdown={event.description} className="mt-4 text-sm text-muted-foreground" />
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
      {tracks.length === 0 ? null : (
        <section className="mt-8">
          <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Tracks
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tracks.map((track) => (
              <Link
                key={track.id}
                to="/e/$eventSlug/sessions"
                params={{ eventSlug }}
                search={{ q: undefined, track: [track.id], format: undefined, room: undefined }}
                className="pressable inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: track.color }} />
                {track.name}
              </Link>
            ))}
          </div>
        </section>
      )}
      {sessions.length === 0 ? null : (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Program highlights
            </h2>
            <Link
              to="/e/$eventSlug/sessions"
              params={{ eventSlug }}
              search={{ q: undefined, track: undefined, format: undefined, room: undefined }}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All {sessions.length} sessions <ArrowRightIcon className="size-3" />
            </Link>
          </div>
          <div className="mt-2 divide-y rounded-lg border">
            {[...sessions]
              .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
              .slice(0, 4)
              .map((session) => (
                <Link
                  key={session.id}
                  to="/e/$eventSlug/sessions/$code"
                  params={{ eventSlug, code: session.code }}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50"
                >
                  <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {sessionSlot(session.startsAt, event.timezone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{session.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {session.speakers.map(publicSpeakerName).join(", ") || session.roomName}
                    </span>
                  </span>
                  {session.tracks[0] === undefined ? null : (
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium sm:inline-flex">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: session.tracks[0].color }}
                      />
                      {session.tracks[0].name}
                    </span>
                  )}
                </Link>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}

// Pinned to the event timezone so SSR and the browser agree.
const sessionSlot = (startsAt: string, timezone: string) => {
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(start);
  return `${day} · ${time}`;
};

// Format in the event's timezone so SSR and the browser agree.
const formatRange = (startsAt: string, endsAt: string, timezone: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: timezone });
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone });
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: timezone });
  return `${month.format(start)} ${day.format(start)}–${day.format(end)}, ${year.format(end)}`;
};
