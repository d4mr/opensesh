import type { AgendaAdminData, AgendaDraftPlacement, AgendaSession } from "@opensesh/domain";
import { useMemo, useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  dateKeyFor,
  eventDateKeys,
  formatDay,
  formatLongDay,
  formatTime,
  minutesFor,
  zonedDateTimeIso,
} from "./date-utils";

const START_MINUTES = 8 * 60;
const END_MINUTES = 19 * 60;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 36;
const slots = Array.from(
  { length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES },
  (_, index) => START_MINUTES + index * SLOT_MINUTES,
);

interface ProposedBlock {
  readonly session: AgendaSession;
  readonly placement: AgendaDraftPlacement;
  readonly changed: boolean;
}

export function DraftCalendar({
  agenda,
  placements,
  changedIds,
}: {
  readonly agenda: AgendaAdminData;
  readonly placements: ReadonlyArray<AgendaDraftPlacement>;
  readonly changedIds: ReadonlySet<string>;
}) {
  const timezone = agenda.event.timezone;
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, timezone);
  const blocks = useMemo(
    () =>
      placements.flatMap((placement): ReadonlyArray<ProposedBlock> => {
        const session = agenda.sessions.find((item) => item.id === placement.submissionId);
        return session === undefined
          ? []
          : [{ session, placement, changed: changedIds.has(session.id) }];
      }),
    [agenda.sessions, changedIds, placements],
  );
  const [day, setDay] = useState(() => {
    const firstChanged = blocks.find((block) => block.changed);
    const anchor = firstChanged ?? blocks[0];
    return anchor === undefined ? (days[0] ?? "") : dateKeyFor(anchor.placement.startsAt, timezone);
  });
  const scheduled = blocks.filter(
    (block) => dateKeyFor(block.placement.startsAt, timezone) === day,
  );

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between gap-4 border-b px-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatLongDay(day)}</p>
          <p className="text-[11px] text-muted-foreground">
            Proposed schedule · changed sessions are highlighted
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={day}
          onValueChange={(value) => value !== "" && setDay(value)}
          variant="outline"
          size="sm"
        >
          {days.map((item) => (
            <ToggleGroupItem key={item} value={item} className="pressable h-7 px-2 text-xs">
              {formatDay(item)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="isolate min-h-0 flex-1 overflow-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `56px repeat(${agenda.rooms.length}, minmax(190px, 1fr))`,
          }}
        >
          <div className="sticky top-0 z-30 h-10 border-b bg-background" />
          {agenda.rooms.map((room) => (
            <div
              key={room.id}
              className="sticky top-0 z-30 flex h-10 items-center border-b border-l bg-background px-2 text-xs font-medium"
            >
              {room.name}
            </div>
          ))}

          <div className="relative bg-muted/20" style={{ height: slots.length * SLOT_HEIGHT }}>
            {slots.map((minutes) => (
              <span
                key={minutes}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
                style={{ top: ((minutes - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT }}
              >
                {minutes % 60 === 0
                  ? formatTime(zonedDateTimeIso(day, minutes, timezone), timezone)
                  : ""}
              </span>
            ))}
          </div>
          {agenda.rooms.map((room) => (
            <div
              key={room.id}
              className="relative border-l bg-background"
              style={{ height: slots.length * SLOT_HEIGHT }}
            >
              {slots.map((minutes) => (
                <div
                  key={minutes}
                  className={cn(
                    "h-9 border-t border-border/70",
                    minutes % 60 === 0 ? "border-t-border" : "",
                  )}
                />
              ))}
              {scheduled
                .filter((block) => block.placement.roomId === room.id)
                .map(({ session, placement, changed }) => {
                  const startMinutes = minutesFor(placement.startsAt, timezone);
                  const duration = Math.round(
                    (Date.parse(placement.endsAt) - Date.parse(placement.startsAt)) / 60_000,
                  );
                  return (
                    <div
                      key={session.id}
                      title={placement.reason}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-md border border-l-[3px] bg-card px-2 py-1",
                        changed ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "",
                      )}
                      style={{
                        top: ((startMinutes - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT + 1,
                        height: Math.max((duration / SLOT_MINUTES) * SLOT_HEIGHT - 2, 34),
                        borderLeftColor: session.tracks[0]?.color,
                      }}
                    >
                      <span className="block truncate text-[13px] font-medium">
                        {session.title}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                        {session.code} · {formatTime(placement.startsAt, timezone)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
