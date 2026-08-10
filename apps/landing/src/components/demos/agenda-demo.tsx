import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui";

const slots = ["9:00", "10:00", "11:00"] as const;
const rooms = ["Room A", "Room B"] as const;

type Cell = { readonly room: number; readonly slot: number };

type Session = {
  readonly id: string;
  readonly title: string;
  readonly speaker: string;
  readonly cell: Cell;
  readonly pinned?: boolean;
};

const initialSessions: readonly Session[] = [
  {
    id: "keynote",
    title: "Opening keynote",
    speaker: "Maya Chen",
    cell: { room: 0, slot: 0 },
    pinned: true,
  },
  { id: "gpu", title: "GPU workshop", speaker: "Maya Chen", cell: { room: 1, slot: 2 } },
  { id: "evals", title: "Evals clinic", speaker: "Rey Park", cell: { room: 1, slot: 1 } },
];

const sameCell = (a: Cell, b: Cell) => a.room === b.room && a.slot === b.slot;

/** Live miniature of the agenda builder: move a session, watch conflicts get caught. */
export function AgendaDemo() {
  const [sessions, setSessions] = useState(initialSessions);
  const [selected, setSelected] = useState<string | undefined>("gpu");

  const conflicts = new Set<string>();
  for (const a of sessions) {
    for (const b of sessions) {
      if (a.id !== b.id && a.speaker === b.speaker && a.cell.slot === b.cell.slot) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  const conflicted = sessions.find((session) => conflicts.has(session.id));

  const moveTo = (cell: Cell) => {
    if (selected === undefined) {
      return;
    }
    setSessions((current) =>
      current.map((session) => (session.id === selected ? { ...session, cell } : session)),
    );
  };

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-10 items-center justify-between border-b bg-paper px-4">
        <p className="text-[13px] font-medium">Tue, Oct 13</p>
        <p className="text-xs text-muted-foreground">Tap a session, then a slot</p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-[44px_1fr_1fr] gap-1.5">
          <div />
          {rooms.map((room) => (
            <p key={room} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {room}
            </p>
          ))}
          {slots.map((slot, slotIndex) => (
            <SlotRow
              key={slot}
              slot={slot}
              slotIndex={slotIndex}
              sessions={sessions}
              selected={selected}
              conflicts={conflicts}
              onSelect={setSelected}
              onMove={moveTo}
            />
          ))}
        </div>
      </div>
      <div
        className="flex h-11 items-center gap-1.5 border-t bg-paper px-4 text-xs"
        aria-live="polite"
      >
        {conflicted === undefined ? (
          <>
            <CircleCheckIcon className="size-3.5 text-status-accepted" aria-hidden="true" />
            <span className="text-muted-foreground">No conflicts. 3 sessions scheduled.</span>
          </>
        ) : (
          <>
            <TriangleAlertIcon className="size-3.5 text-status-declined" aria-hidden="true" />
            <span className="font-medium text-status-declined">
              {conflicted.speaker} is in two rooms at {slots[conflicted.cell.slot]}.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  slotIndex,
  sessions,
  selected,
  conflicts,
  onSelect,
  onMove,
}: {
  readonly slot: string;
  readonly slotIndex: number;
  readonly sessions: readonly Session[];
  readonly selected: string | undefined;
  readonly conflicts: ReadonlySet<string>;
  readonly onSelect: (id: string | undefined) => void;
  readonly onMove: (cell: Cell) => void;
}) {
  return (
    <>
      <p className="self-center font-mono text-[11px] text-muted-foreground tabular-nums">{slot}</p>
      {[0, 1].map((roomIndex) => {
        const cell: Cell = { room: roomIndex, slot: slotIndex };
        const occupant = sessions.find((session) => sameCell(session.cell, cell));
        if (occupant === undefined) {
          return (
            <button
              key={roomIndex}
              type="button"
              aria-label={`Move to ${slot}`}
              onClick={() => onMove(cell)}
              disabled={selected === undefined}
              className={cn(
                "pressable h-12 rounded-md border border-dashed transition-colors",
                selected !== undefined
                  ? "border-primary/50 bg-status-accepted-bg/40 hover:bg-status-accepted-bg"
                  : "border-border",
              )}
            />
          );
        }
        const isSelected = occupant.id === selected;
        const inConflict = conflicts.has(occupant.id);
        return (
          <button
            key={roomIndex}
            type="button"
            disabled={occupant.pinned === true}
            onClick={() => onSelect(isSelected ? undefined : occupant.id)}
            className={cn(
              "pressable h-12 rounded-md border px-2 text-left transition-all",
              inConflict
                ? "border-status-declined bg-status-declined-bg"
                : occupant.pinned === true
                  ? "bg-paper"
                  : "bg-background",
              isSelected && "border-primary ring-2 ring-primary/25",
              occupant.pinned !== true && !isSelected && "hover:border-primary/50",
            )}
          >
            <p className="truncate text-xs font-medium">{occupant.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {occupant.speaker}
              {occupant.pinned === true ? " · pinned" : ""}
            </p>
          </button>
        );
      })}
    </>
  );
}
