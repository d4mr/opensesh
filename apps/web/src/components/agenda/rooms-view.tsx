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
import { Link } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PlusIcon,
  SearchIcon,
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

import { PersonHoverCard } from "@/components/app/person-popover";
import { RichText } from "@/components/forms/rich-text";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScheduleEditor } from "./schedule-editor";

const START_MINUTES = 8 * 60;
const END_MINUTES = 19 * 60;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 36;
const slots = Array.from(
  { length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES },
  (_, index) => START_MINUTES + index * SLOT_MINUTES,
);

const slotId = (roomId: string, day: string, minutes: number) => `slot:${roomId}:${day}:${minutes}`;

function AgendaSpeakerNames({
  speakers,
  tags = false,
}: {
  readonly speakers: AgendaSession["speakers"];
  readonly tags?: boolean;
}) {
  if (speakers.length === 0) return <>No speaker</>;
  return (
    <>
      {speakers.map((speaker, index) => (
        <span key={speaker.id}>
          {index === 0 || tags ? null : ", "}
          {tags ? (
            <SpeakerBadge
              side="right"
              person={{ id: speaker.id, name: speaker.name, image: null }}
            />
          ) : (
            <PersonHoverCard
              side="right"
              person={{ id: speaker.id, name: speaker.name, image: null }}
            >
              <span>{speaker.name}</span>
            </PersonHoverCard>
          )}
        </span>
      ))}
    </>
  );
}

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
  conflicted,
  highlighted,
  open,
  remove,
  resize,
}: {
  readonly session: AgendaSession;
  readonly timezone: string;
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
    session.startsAt === null ? START_MINUTES : minutesFor(session.startsAt, timezone);
  const track = session.tracks[0];
  const style: CSSProperties = {
    top: ((startMinutes - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT + 1,
    height: Math.max((previewDuration / SLOT_MINUTES) * SLOT_HEIGHT - 2, 34),
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
          const maxDuration = END_MINUTES - startMinutes;
          setPreviewDuration(
            Math.max(
              SLOT_MINUTES,
              Math.min(maxDuration, resizeStart.current.duration + deltaSlots * SLOT_MINUTES),
            ),
          );
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const next = Math.max(
            SLOT_MINUTES,
            Math.min(
              END_MINUTES - startMinutes,
              originalDuration + (event.key === "ArrowDown" ? SLOT_MINUTES : -SLOT_MINUTES),
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

function SessionPeek({
  agenda,
  session,
  open,
  onOpenChange,
  save,
}: {
  readonly agenda: AgendaAdminData;
  readonly session: AgendaSession | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly save: (change: ScheduleChange) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {session === null ? null : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {session.code}
                </span>
                {session.tracks.map((track) => (
                  <span
                    key={track.id}
                    className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none"
                    style={{
                      borderColor: track.color,
                      color: track.color,
                      backgroundColor: `color-mix(in srgb, ${track.color} 9%, transparent)`,
                    }}
                  >
                    {track.name}
                  </span>
                ))}
              </div>
              <DialogTitle className="text-base tracking-tight">{session.title}</DialogTitle>
              <DialogDescription>
                {session.formatName ?? "Session"} · {session.durationMinutes} minutes ·{" "}
                {session.startsAt === null
                  ? "Unscheduled"
                  : formatTime(session.startsAt, agenda.event.timezone)}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[50svh] gap-3 overflow-y-auto text-sm">
              <div className="flex flex-wrap items-center gap-1">
                <AgendaSpeakerNames speakers={session.speakers} tags />
              </div>
              <RichText
                markdown={session.description}
                className="leading-relaxed text-muted-foreground"
              />
            </div>
            <DialogFooter className="border-t pt-4 sm:justify-between">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="pressable text-muted-foreground"
                asChild
              >
                <Link to="/admin/sessions" search={{ state: "all", spotlight: session.id }}>
                  <ExternalLinkIcon /> Open session
                </Link>
              </Button>
              <ScheduleEditor agenda={agenda} session={session} save={save} />
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const timezone = agenda.event.timezone;
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, timezone);
  const scheduled = agenda.sessions.filter(
    (session) => session.startsAt !== null && dateKeyFor(session.startsAt, timezone) === day,
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
              <p className="text-[11px] text-muted-foreground">8:00 AM–7:00 PM · 15-minute grid</p>
            </div>
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
                    <DropSlot key={minutes} roomId={room.id} day={day} minutes={minutes} />
                  ))}
                  {scheduled
                    .filter((session) => session.roomId === room.id)
                    .map((session) => (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        timezone={timezone}
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
