import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon } from "lucide-react";

import { speakerPortalQuery } from "@/lib/portal-queries";

// Format in the event's timezone so SSR and the browser agree.
const sessionSlot = (startsAt: Date, endsAt: Date, timezone: string) => {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${day.format(new Date(startsAt))} · ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`;
};

export function PortalSessions() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  const data = portal.data.data;
  const sessions = data.submissions.filter(({ submission }) => submission.status === "accepted");

  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">My Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Your accepted sessions at {data.event.name} · {sessions.length}{" "}
          {sessions.length === 1 ? "session" : "sessions"}
        </p>
      </div>
      {sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No accepted sessions yet — accepted submissions appear here automatically.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {sessions.map(({ submission, format }) => (
            <Link
              key={submission.id}
              to="/portal/$section"
              params={{ section: "submissions" }}
              search={{ spotlight: submission.id }}
              className="pressable flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {submission.code}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{submission.title}</span>
              {format === null ? null : (
                <span className="shrink-0 text-xs text-muted-foreground">{format.name}</span>
              )}
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDaysIcon className="size-3.5" />
                {submission.startsAt === null || submission.endsAt === null
                  ? "Not scheduled yet"
                  : sessionSlot(submission.startsAt, submission.endsAt, data.event.timezone)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
