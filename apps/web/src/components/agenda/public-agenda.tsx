import type { PublicAgenda as PublicAgendaData } from "@opensesh/domain";
import { CalendarDaysIcon } from "lucide-react";

import { dateKeyFor, formatLongDay, formatTime } from "./date-utils";

export function PublicAgenda({ agenda }: { readonly agenda: PublicAgendaData | null }) {
  if (agenda === null) {
    return (
      <main className="mx-auto flex max-w-sm flex-col items-center px-4 py-24 text-center">
        <div className="wizard-pop flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarDaysIcon className="size-5" />
        </div>
        <h1 className="mt-4 font-semibold tracking-tight">Agenda coming soon</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The program team is still arranging sessions. Check back after the agenda is published.
        </p>
      </main>
    );
  }

  const days = new Map<string, typeof agenda.sessions>();
  for (const session of agenda.sessions) {
    const day = dateKeyFor(session.startsAt, agenda.event.timezone);
    days.set(day, [...(days.get(day) ?? []), session]);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Times are shown in {agenda.event.timezone.replaceAll("_", " ")}.
        </p>
      </div>
      <div className="mt-7 grid gap-7">
        {Array.from(days, ([day, sessions]) => (
          <section key={day}>
            <h2 className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {formatLongDay(day)}
            </h2>
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              {sessions.map((session) => (
                <article key={session.id} className="grid grid-cols-[92px_1fr] gap-3 px-3 py-3">
                  <div className="text-xs tabular-nums">
                    <p className="font-medium">
                      {formatTime(session.startsAt, agenda.event.timezone)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {formatTime(session.endsAt, agenda.event.timezone)}
                    </p>
                  </div>
                  <div
                    className="min-w-0 border-l-2 pl-3"
                    style={{ borderLeftColor: session.tracks[0]?.color }}
                  >
                    <h3 className="text-sm font-medium">{session.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.speakers.map((speaker) => speaker.name).join(", ") || "Speaker TBA"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {session.roomName}
                      {session.tracks.length === 0
                        ? ""
                        : ` · ${session.tracks.map((track) => track.name).join(", ")}`}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 border-t pt-3 text-[11px] text-muted-foreground">
        Published{" "}
        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(agenda.event.publishedAt),
        )}
      </p>
    </main>
  );
}
