import type { AgendaAdminData, AgendaSession, ScheduleChange } from "@opensesh/domain";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangleIcon,
  GripVerticalIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { TimezoneChip } from "@/components/app/timezone-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  dateKeyFor,
  eventDateKeys,
  formatDay,
  formatLongDay,
  formatTime,
  minuteLabel,
  minutesFor,
  zonedDateTimeIso,
} from "./date-utils";
import { AgendaSpeakerNames, SessionPeek } from "./session-peek";

const SLOT_HEIGHT = 36;

// The grid's increment and open/close times are a per-user view preference —
// the data-model floor stays validateScheduleChange's 5-minute mark. The grid
// widens itself past the preference whenever a session sits outside it, so a
// placement can never become invisible.
interface GridConfig {
  readonly start: number;
  readonly end: number;
  readonly slot: number;
}
const gridConfigKey = "agenda-grid-config";
const defaultGridConfig: GridConfig = { start: 8 * 60, end: 19 * 60, slot: 15 };
const slotChoices = [5, 10, 15, 30];
const timeRange = (from: number, to: number) =>
  Array.from({ length: (to - from) / 30 + 1 }, (_, index) => from + index * 30);

const loadGridConfig = (): GridConfig => {
  try {
    const raw = localStorage.getItem(gridConfigKey);
    if (raw === null) return defaultGridConfig;
    const record = JSON.parse(raw) as Record<string, unknown>;
    const slot =
      typeof record.slot === "number" && slotChoices.includes(record.slot)
        ? record.slot
        : defaultGridConfig.slot;
    const start =
      typeof record.start === "number" && record.start >= 0 && record.start % 30 === 0
        ? record.start
        : defaultGridConfig.start;
    const end =
      typeof record.end === "number" && record.end <= 24 * 60 && record.end % 30 === 0
        ? record.end
        : defaultGridConfig.end;
    return end > start ? { start, end, slot } : defaultGridConfig;
  } catch {
    return defaultGridConfig;
  }
};

const slotId = (roomId: string, day: string, minutes: number) => `slot:${roomId}:${day}:${minutes}`;

function DropSlot({ roomId, day, minutes }: { roomId: string; day: string; minutes: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: slotId(roomId, day, minutes) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-9 border-t border-border/70 transition-colors",
        minutes % 60 === 0 ? "border-t-border" : "",
        isOver ? "bg-primary/10" : "",
      )}
    />
  );
}

function SessionBlock({
  session,
  timezone,
  grid,
  conflicted,
  highlighted,
  open,
  remove,
  resize,
}: {
  readonly session: AgendaSession;
  readonly timezone: string;
  readonly grid: GridConfig;
  readonly conflicted: boolean;
  readonly highlighted: boolean;
  readonly open: () => void;
  readonly remove: () => void;
  readonly resize: (minutes: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `session:${session.id}`,
  });
  // A drop fires a click on the block; swallow that one so dragging never
  // pops the peek dialog open.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);
  const clickOpen = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    open();
  };
  const originalDuration =
    session.startsAt === null || session.endsAt === null
      ? session.durationMinutes
      : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
  const [previewDuration, setPreviewDuration] = useState(originalDuration);
  const resizeStart = useRef<{ readonly y: number; readonly duration: number } | null>(null);
  const startMinutes =
    session.startsAt === null ? grid.start : minutesFor(session.startsAt, timezone);
  const track = session.tracks[0];
  const style: CSSProperties = {
    top: ((startMinutes - grid.start) / grid.slot) * SLOT_HEIGHT + 1,
    height: Math.max((previewDuration / grid.slot) * SLOT_HEIGHT - 2, 34),
    borderLeftColor: track?.color,
    transform:
      transform === null
        ? undefined
        : `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`,
  };

  useEffect(() => setPreviewDuration(originalDuration), [originalDuration]);

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeStart.current === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    resizeStart.current = null;
    if (previewDuration !== originalDuration) resize(previewDuration);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-agenda-session={session.id}
      onClick={clickOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        open();
      }}
      className={cn(
        "group absolute inset-x-1 z-10 cursor-pointer touch-none overflow-hidden rounded-md border border-l-[3px] bg-card px-2 py-1 text-left transition-[opacity,box-shadow,background-color] duration-150 hover:bg-muted/50",
        conflicted ? "ring-2 ring-destructive ring-inset" : "",
        highlighted ? "agenda-highlight" : "",
        isDragging ? "opacity-30" : "",
      )}
    >
      <span className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{session.title}</span>
        {conflicted ? (
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        ) : null}
      </span>
      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground tabular-nums">
        {session.code} · <AgendaSpeakerNames speakers={session.speakers} />
      </span>
      <button
        type="button"
        aria-label={`Remove ${session.title} from agenda`}
        className="agenda-block-action pressable absolute top-1 right-1 rounded-sm bg-card p-0.5 text-muted-foreground opacity-0 transition-opacity focus:opacity-100"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          remove();
        }}
      >
        <XIcon className="size-3" />
      </button>
      <div
        role="separator"
        aria-label={`Resize ${session.title}`}
        tabIndex={0}
        className="agenda-resize-handle absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeStart.current = { y: event.clientY, duration: originalDuration };
        }}
        onPointerMove={(event) => {
          if (resizeStart.current === null) return;
          const deltaSlots = Math.round((event.clientY - resizeStart.current.y) / SLOT_HEIGHT);
          const maxDuration = grid.end - startMinutes;
          setPreviewDuration(
            Math.max(
              grid.slot,
              Math.min(maxDuration, resizeStart.current.duration + deltaSlots * grid.slot),
            ),
          );
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const next = Math.max(
            grid.slot,
            Math.min(
              grid.end - startMinutes,
              originalDuration + (event.key === "ArrowDown" ? grid.slot : -grid.slot),
            ),
          );
          if (next !== originalDuration) resize(next);
        }}
      >
        <span className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-foreground/20" />
      </div>
    </div>
  );
}

function PoolSession({
  session,
  open,
}: {
  readonly session: AgendaSession;
  readonly open: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `session:${session.id}`,
  });
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);
  const style: CSSProperties = {
    transform:
      transform === null
        ? undefined
        : `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`,
    borderLeftColor: session.tracks[0]?.color,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        open();
      }}
      className={cn(
        "flex w-full cursor-pointer touch-none items-start gap-2 border-l-2 px-3 py-2.5 text-left transition-[background-color,opacity] hover:bg-muted/50",
        isDragging ? "opacity-30" : "",
      )}
    >
      <GripVerticalIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{session.title}</span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground tabular-nums">
          {session.code} · {session.durationMinutes} min
        </span>
      </span>
    </button>
  );
}

function AddRoomColumn({ addRoom }: { readonly addRoom: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const submit = async () => {
    if (name.trim() === "") return;
    if (await addRoom(name.trim())) {
      setName("");
      setEditing(false);
    }
  };
  return (
    <div className="border-l bg-muted/20">
      <div className="sticky top-0 z-20 flex h-10 items-center border-b bg-background px-2">
        {editing ? (
          <Input
            aria-label="Room name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => name.trim() === "" && setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
              if (event.key === "Escape") setEditing(false);
            }}
            className="h-7"
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="pressable w-full"
            onClick={() => setEditing(true)}
          >
            <PlusIcon /> Add room
          </Button>
        )}
      </div>
    </div>
  );
}

export function RoomsView({
  agenda,
  day,
  onDayChange,
  conflictedIds,
  highlightedIds,
  save,
  addRoom,
}: {
  readonly agenda: AgendaAdminData;
  readonly day: string;
  readonly onDayChange: (day: string) => void;
  readonly conflictedIds: ReadonlySet<string>;
  readonly highlightedIds: ReadonlySet<string>;
  readonly save: (change: ScheduleChange) => Promise<boolean>;
  readonly addRoom: (name: string) => Promise<boolean>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeSession, setActiveSession] = useState<AgendaSession | null>(null);
  // Track the peeked session by id and derive the row from live agenda data —
  // holding the object would freeze the open dialog on pre-mutation state.
  const [peekSessionId, setPeekSessionId] = useState<string | null>(null);
  const peekSession =
    peekSessionId === null
      ? null
      : (agenda.sessions.find((session) => session.id === peekSessionId) ?? null);
  const [search, setSearch] = useState("");
  const [trackId, setTrackId] = useState("all");
  const [gridConfig, setGridConfig] = useState(loadGridConfig);
  const timezone = agenda.event.timezone;
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, timezone);
  const scheduled = agenda.sessions.filter(
    (session) => session.startsAt !== null && dateKeyFor(session.startsAt, timezone) === day,
  );

  const updateGridConfig = (patch: Partial<GridConfig>) =>
    setGridConfig((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(gridConfigKey, JSON.stringify(next));
      return next;
    });

  // Effective bounds: the preference, widened to whole hours around any
  // session scheduled outside it.
  const scheduledSpans = scheduled.flatMap((session) => {
    if (session.startsAt === null || session.endsAt === null) return [];
    const start = minutesFor(session.startsAt, timezone);
    return [
      {
        start,
        end:
          start + Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000),
      },
    ];
  });
  const gridStart = Math.max(
    0,
    Math.floor(Math.min(gridConfig.start, ...scheduledSpans.map((span) => span.start)) / 60) * 60,
  );
  const gridEnd = Math.min(
    24 * 60,
    Math.ceil(Math.max(gridConfig.end, ...scheduledSpans.map((span) => span.end)) / 60) * 60,
  );
  const grid: GridConfig = { start: gridStart, end: gridEnd, slot: gridConfig.slot };
  const slots = useMemo(
    () =>
      Array.from(
        { length: Math.ceil((gridEnd - gridStart) / gridConfig.slot) },
        (_, index) => gridStart + index * gridConfig.slot,
      ),
    [gridStart, gridEnd, gridConfig.slot],
  );
  const pool = useMemo(
    () =>
      agenda.sessions.filter(
        (session) =>
          session.startsAt === null &&
          session.title.toLowerCase().includes(search.toLowerCase()) &&
          (trackId === "all" || session.tracks.some((track) => track.id === trackId)),
      ),
    [agenda.sessions, search, trackId],
  );

  useEffect(() => {
    const first = highlightedIds.values().next().value;
    if (typeof first !== "string") return;
    document.querySelector(`[data-agenda-session="${first}"]`)?.scrollIntoView({ block: "center" });
  }, [day, highlightedIds]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id).replace(/^session:/, "");
    setActiveSession(agenda.sessions.find((session) => session.id === id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSession(null);
    if (event.over === null) return;
    const [kind, roomId, targetDay, minuteText] = String(event.over.id).split(":");
    if (kind !== "slot" || roomId === undefined || targetDay === undefined) return;
    const minutes = Number(minuteText);
    const sessionId = String(event.active.id).replace(/^session:/, "");
    const session = agenda.sessions.find((item) => item.id === sessionId);
    if (session === undefined || !Number.isFinite(minutes)) return;
    const duration =
      session.startsAt === null || session.endsAt === null
        ? session.durationMinutes
        : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);
    const startsAt = zonedDateTimeIso(targetDay, minutes, timezone);
    void save({
      eventId: agenda.event.id,
      submissionId: session.id,
      roomId,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + duration * 60_000).toISOString(),
    });
  };

  return (
    <DndContext
      id="agenda-rooms-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveSession(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 flex-1 gap-3">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <div className="flex h-11 items-center justify-between border-b px-3">
            <div>
              <p className="text-sm font-medium">{formatLongDay(day)}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {minuteLabel(gridStart)}–{minuteLabel(gridEnd)} · {gridConfig.slot}-minute grid{" "}
                <TimezoneChip timezone={timezone} />
              </p>
            </div>
            <div className="flex items-center gap-1">
              <ToggleGroup
                type="single"
                value={day}
                onValueChange={(value) => value !== "" && onDayChange(value)}
                variant="outline"
                size="sm"
              >
                {days.map((item) => (
                  <ToggleGroupItem key={item} value={item} className="pressable h-7 px-2 text-xs">
                    {formatDay(item)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="pressable"
                    aria-label="Grid settings"
                  >
                    <Settings2Icon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-3">
                  <div className="grid gap-3">
                    <p className="text-xs font-medium">Grid settings</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="grid-slot" className="text-xs text-muted-foreground">
                        Time increment
                      </Label>
                      <Select
                        value={String(gridConfig.slot)}
                        onValueChange={(value) => updateGridConfig({ slot: Number(value) })}
                      >
                        <SelectTrigger id="grid-slot" size="sm" className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {slotChoices.map((choice) => (
                            <SelectItem key={choice} value={String(choice)}>
                              {choice} minutes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grid-start" className="text-xs text-muted-foreground">
                        Opens at
                      </Label>
                      <Select
                        value={String(gridConfig.start)}
                        onValueChange={(value) => updateGridConfig({ start: Number(value) })}
                      >
                        <SelectTrigger id="grid-start" size="sm" className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeRange(5 * 60, 12 * 60).map((minutes) => (
                            <SelectItem key={minutes} value={String(minutes)}>
                              {minuteLabel(minutes)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grid-end" className="text-xs text-muted-foreground">
                        Closes at
                      </Label>
                      <Select
                        value={String(gridConfig.end)}
                        onValueChange={(value) => updateGridConfig({ end: Number(value) })}
                      >
                        <SelectTrigger id="grid-end" size="sm" className="w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeRange(13 * 60, 24 * 60).map((minutes) => (
                            <SelectItem key={minutes} value={String(minutes)}>
                              {minuteLabel(minutes)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* The grid is the page's only scroll surface (both axes); isolate
              keeps its sticky/z layers from stacking above the app sidebar. */}
          <div className="isolate min-h-0 flex-1 overflow-auto">
            <div
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `56px repeat(${agenda.rooms.length}, minmax(190px, 1fr)) 150px`,
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
              <div className="sticky top-0 z-30 h-10 border-b border-l bg-background" />

              <div className="relative bg-muted/20" style={{ height: slots.length * SLOT_HEIGHT }}>
                {slots.map((minutes) => (
                  <span
                    key={minutes}
                    className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
                    style={{ top: ((minutes - gridStart) / gridConfig.slot) * SLOT_HEIGHT }}
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
                    <DropSlot key={minutes} roomId={room.id} day={day} minutes={minutes} />
                  ))}
                  {scheduled
                    .filter((session) => session.roomId === room.id)
                    .map((session) => (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        timezone={timezone}
                        grid={grid}
                        conflicted={conflictedIds.has(session.id)}
                        highlighted={highlightedIds.has(session.id)}
                        open={() => setPeekSessionId(session.id)}
                        remove={() =>
                          void save({
                            eventId: agenda.event.id,
                            submissionId: session.id,
                            roomId: null,
                            startsAt: null,
                            endsAt: null,
                          })
                        }
                        resize={(duration) => {
                          if (session.startsAt === null) return;
                          void save({
                            eventId: agenda.event.id,
                            submissionId: session.id,
                            roomId: session.roomId,
                            startsAt: session.startsAt,
                            endsAt: new Date(
                              Date.parse(session.startsAt) + duration * 60_000,
                            ).toISOString(),
                          });
                        }}
                      />
                    ))}
                </div>
              ))}
              <AddRoomColumn addRoom={addRoom} />
            </div>
          </div>
        </section>

        <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-3 py-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Unscheduled</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{pool.length}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Drag accepted sessions onto a room.
            </p>
          </div>
          <div className="grid gap-2 border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search unscheduled sessions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sessions…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select value={trackId} onValueChange={(value) => value !== null && setTrackId(value)}>
              <SelectTrigger size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tracks</SelectItem>
                {agenda.tracks.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {pool.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No matching sessions.
              </p>
            ) : (
              pool.map((session) => (
                <PoolSession
                  key={session.id}
                  session={session}
                  open={() => setPeekSessionId(session.id)}
                />
              ))
            )}
          </div>
        </aside>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeSession === null ? null : (
          <div
            className="w-56 scale-[1.02] rounded-md border border-l-[3px] bg-card px-2 py-1.5 shadow-md"
            style={{ borderLeftColor: activeSession.tracks[0]?.color }}
          >
            <p className="truncate text-[13px] font-medium">{activeSession.title}</p>
            <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {activeSession.code}
            </p>
          </div>
        )}
      </DragOverlay>

      <SessionPeek
        agenda={agenda}
        session={peekSession}
        open={peekSession !== null}
        onOpenChange={(open) => !open && setPeekSessionId(null)}
        save={save}
      />
    </DndContext>
  );
}
