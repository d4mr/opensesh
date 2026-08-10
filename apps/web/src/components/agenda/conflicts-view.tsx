import type { AgendaAdminData, AgendaConflict } from "@opensesh/domain";
import { AlertTriangleIcon, ArrowRightIcon, CircleCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDay, formatTime, dateKeyFor } from "./date-utils";

export function ConflictsView({
  agenda,
  conflicts,
  jump,
}: {
  readonly agenda: AgendaAdminData;
  readonly conflicts: ReadonlyArray<AgendaConflict>;
  readonly jump: (conflict: AgendaConflict) => void;
}) {
  const sessionById = new Map(agenda.sessions.map((session) => [session.id, session]));
  const roomById = new Map(agenda.rooms.map((room) => [room.id, room.name]));
  const timezone = agenda.event.timezone;

  if (conflicts.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center py-20 text-center">
        <div className="wizard-pop flex size-11 items-center justify-center rounded-full bg-status-accepted-bg text-status-accepted">
          <CircleCheckIcon className="size-5" />
        </div>
        <h2 className="mt-4 font-semibold tracking-tight">No schedule conflicts</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Rooms and speakers are clear across the current draft.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {conflicts.map((conflict) => {
        const first = sessionById.get(conflict.sessionIds[0]);
        const second = sessionById.get(conflict.sessionIds[1]);
        if (first === undefined || second === undefined) return null;
        const where =
          conflict.kind === "room"
            ? (roomById.get(conflict.roomId ?? "") ?? "Unknown room")
            : [first.roomId, second.roomId]
                .map((roomId) => roomById.get(roomId ?? ""))
                .filter((room): room is string => room !== undefined)
                .join(" and ");
        return (
          <article key={conflict.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangleIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">
                      {conflict.kind === "room" ? "Room overlap" : "Speaker double-booking"}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDay(dateKeyFor(conflict.startsAt, timezone))},{" "}
                      {formatTime(conflict.startsAt, timezone)}–
                      {formatTime(conflict.endsAt, timezone)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pressable -mt-1 -mr-1 h-7 shrink-0 text-xs"
                    onClick={() => jump(conflict)}
                  >
                    Jump to rooms <ArrowRightIcon />
                  </Button>
                </div>
                <dl className="mt-3 grid gap-1.5 border-t pt-2.5 text-xs sm:grid-cols-[64px_1fr]">
                  <dt className="text-muted-foreground">What</dt>
                  <dd className="font-medium">
                    <span className="font-mono tabular-nums">{first.code}</span> {first.title}
                    <span className="mx-1.5 text-muted-foreground">and</span>
                    <span className="font-mono tabular-nums">{second.code}</span> {second.title}
                  </dd>
                  <dt className="text-muted-foreground">Who</dt>
                  <dd>
                    {conflict.speaker?.name ??
                      [...first.speakers, ...second.speakers]
                        .map((speaker) => speaker.name)
                        .join(", ")}
                  </dd>
                  <dt className="text-muted-foreground">Where</dt>
                  <dd>{where || "Rooms not found"}</dd>
                  <dt className="text-muted-foreground">Why</dt>
                  <dd className="text-muted-foreground">
                    {conflict.kind === "room"
                      ? `Both sessions occupy ${where} during the same time window.`
                      : `${conflict.speaker?.name ?? "This speaker"} is assigned to both sessions at once.`}
                  </dd>
                </dl>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
