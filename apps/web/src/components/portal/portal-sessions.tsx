import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, ChevronRightIcon } from "lucide-react";

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
    <main className="h-[calc(100svh-3rem)] overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">My sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length === 0
            ? `Accepted sessions at ${data.event.name} appear here automatically.`
            : `Your ${sessions.length === 1 ? "accepted session" : `${sessions.length} accepted sessions`} at ${data.event.name}.`}
        </p>
        {sessions.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No accepted sessions yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 pb-10">
            {sessions.map(({ submission, format }) => (
              <Link
                key={submission.id}
                to="/portal/$section"
                params={{ section: "submissions" }}
                search={{ spotlight: submission.id }}
                className="pressable group block rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {submission.code}
                  </span>
                  {format === null ? null : (
                    <span className="text-xs text-muted-foreground">{format.name}</span>
                  )}
                  <ChevronRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
                </div>
                <h2 className="mt-2.5 text-base font-semibold tracking-tight">
                  {submission.title}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDaysIcon className="size-4" />
                  {submission.startsAt === null || submission.endsAt === null
                    ? "Not scheduled yet"
                    : sessionSlot(submission.startsAt, submission.endsAt, data.event.timezone)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
