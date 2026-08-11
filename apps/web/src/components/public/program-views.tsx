import {
  filterPublicProgram,
  filterPublicSessions,
  publicDateKey,
  publicSpeakerName,
  restorePersonalSchedule,
  serializePersonalSchedule,
  type PublicProgram,
  type PublicSession,
  type PublicSpeaker,
  type WidgetOptions,
  type WidgetView,
} from "@opensesh/domain";
import { Link } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  Clock3Icon,
  DownloadIcon,
  MapPinIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadPersonalScheduleIcs, downloadPublicSessionIcs } from "@/server-fns/widgets";

export interface SessionListState {
  readonly query: string;
  readonly trackIds: ReadonlyArray<string>;
  readonly formatIds: ReadonlyArray<string>;
  readonly rooms: ReadonlyArray<string>;
}

const emptySessionListState: SessionListState = {
  query: "",
  trackIds: [],
  formatIds: [],
  rooms: [],
};

interface SpeakerEntry {
  readonly speaker: PublicSpeaker;
  readonly sessions: ReadonlyArray<PublicSession>;
}

const dayLabel = (value: string, timezone: string, long = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
const timeLabel = (value: string, timezone: string, format: "12h" | "24h") =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  }).format(new Date(value));
const dateTimeRange = (session: PublicSession, timezone: string, format: "12h" | "24h" = "12h") =>
  `${dayLabel(session.startsAt, timezone, true)}, ${timeLabel(session.startsAt, timezone, format)}–${timeLabel(session.endsAt, timezone, format)}`;
const unique = <Value,>(values: ReadonlyArray<Value>) => Array.from(new Set(values));
const uniqueDays = (sessions: ReadonlyArray<PublicSession>, timezone: string) =>
  unique(sessions.map((session) => publicDateKey(session.startsAt, timezone)));
const speakerFallback = (speaker: PublicSpeaker, options?: WidgetOptions) =>
  [
    (options?.showSpeakerTitle ?? true) ? (speaker.title ?? "Title not provided") : null,
    (options?.showSpeakerCompany ?? true) ? (speaker.company ?? "Independent") : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");

export const speakersFor = (program: PublicProgram): ReadonlyArray<SpeakerEntry> => {
  const map = new Map<string, SpeakerEntry>();
  for (const session of program.sessions) {
    for (const speaker of session.speakers) {
      const entry = map.get(speaker.id) ?? { speaker, sessions: [] };
      map.set(speaker.id, { speaker, sessions: [...entry.sessions, session] });
    }
  }
  return Array.from(map.values()).sort(
    (left, right) =>
      left.speaker.lastName.localeCompare(right.speaker.lastName) ||
      left.speaker.firstName.localeCompare(right.speaker.firstName),
  );
};

function EmptyProgram({ agenda = false }: { readonly agenda?: boolean }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <div className="wizard-pop flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {agenda ? <CalendarDaysIcon className="size-5" /> : <UsersIcon className="size-5" />}
      </div>
      <h2 className="mt-4 font-semibold tracking-tight">
        {agenda ? "The agenda hasn't been published yet" : "Nothing published yet"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {agenda
          ? "Check back when the program team publishes the schedule."
          : "Published program details will appear here."}
      </p>
    </div>
  );
}

function TrackChip({ track }: { readonly track: PublicSession["tracks"][number] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: track.color }} />
      {track.name}
    </span>
  );
}

function FormatChip({ session }: { readonly session: PublicSession }) {
  return session.format === null ? null : (
    <span className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium">
      {session.format.name}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "pressable rounded-md border px-2 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/60",
      )}
    >
      {children}
    </button>
  );
}

const toggleValue = (values: ReadonlyArray<string>, value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

function Facet({
  label,
  values,
  selected,
  onChange,
}: {
  readonly label: string;
  readonly values: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly selected: ReadonlyArray<string>;
  readonly onChange: (values: ReadonlyArray<string>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
      {values.map((value) => (
        <FilterChip
          key={value.id}
          active={selected.includes(value.id)}
          onClick={() => onChange(toggleValue(selected, value.id))}
        >
          {value.name}
        </FilterChip>
      ))}
    </div>
  );
}

const sessionCount = (count: number) => `${count} ${count === 1 ? "session" : "sessions"}`;

function usePersonalSchedule(program: PublicProgram) {
  const storageKey = `opensesh-my-schedule:${program.event.id}`;
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const valid = new Set(program.sessions.map((session) => session.id));
    const restore = () =>
      setSelectedIds(
        restorePersonalSchedule(window.localStorage.getItem(storageKey)).filter((id) =>
          valid.has(id),
        ),
      );
    restore();
    setReady(true);
    window.addEventListener(storageKey, restore);
    return () => window.removeEventListener(storageKey, restore);
  }, [storageKey, program.sessions]);
  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    window.localStorage.setItem(storageKey, serializePersonalSchedule(next));
    setSelectedIds(next);
    window.dispatchEvent(new Event(storageKey));
  };
  return { selectedIds, toggle, ready };
}

function ScheduleAction({
  session,
  selected,
  onToggle,
  className,
}: {
  readonly session: PublicSession;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${selected ? "Remove" : "Add"} ${session.title} ${selected ? "from" : "to"} My Schedule`}
      aria-pressed={selected}
      title={selected ? "Remove from My Schedule" : "Add to My Schedule"}
      onClick={onToggle}
      className={cn(
        "pressable flex size-7 items-center justify-center rounded-md border bg-background transition-colors",
        selected ? "border-primary/40 text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <StarIcon className={cn("size-3.5", selected && "fill-current")} />
    </button>
  );
}

export function SessionList({
  program,
  options,
  controls = true,
  state,
  onStateChange,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly controls?: boolean;
  readonly state?: SessionListState;
  readonly onStateChange?: (state: SessionListState) => void;
}) {
  const [localState, setLocalState] = useState(emptySessionListState);
  const [expanded, setExpanded] = useState<ReadonlyArray<string>>([]);
  const schedule = usePersonalSchedule(program);
  const currentState = state ?? localState;
  const updateState = onStateChange ?? setLocalState;
  const base = filterPublicProgram(program, options).sessions;
  const rooms = unique(base.map((session) => session.roomName)).sort((a, b) => a.localeCompare(b));
  const sessions = filterPublicSessions(base, {
    timezone: program.event.timezone,
    search: currentState.query,
    trackIds: currentState.trackIds,
    formatIds: currentState.formatIds,
    roomNames: currentState.rooms,
  });
  const activeCount =
    currentState.trackIds.length + currentState.formatIds.length + currentState.rooms.length;
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  return (
    <div className="grid gap-4">
      {controls ? (
        <div className="grid gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-md">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={currentState.query}
                onChange={(event) => updateState({ ...currentState, query: event.target.value })}
                className="h-8 pl-8"
                placeholder="Search by session or speaker…"
                aria-label="Search sessions by title or speaker"
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {sessions.length} of {sessionCount(base.length)}
            </p>
          </div>
          <Facet
            label="Track"
            values={program.tracks}
            selected={currentState.trackIds}
            onChange={(trackIds) => updateState({ ...currentState, trackIds })}
          />
          <Facet
            label="Format"
            values={program.formats}
            selected={currentState.formatIds}
            onChange={(formatIds) => updateState({ ...currentState, formatIds })}
          />
          <Facet
            label="Room"
            values={rooms.map((room) => ({ id: room, name: room }))}
            selected={currentState.rooms}
            onChange={(selectedRooms) => updateState({ ...currentState, rooms: selectedRooms })}
          />
          {activeCount > 0 || currentState.query !== "" ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {activeCount} active {activeCount === 1 ? "filter" : "filters"}
              </span>
              <button
                type="button"
                className="pressable font-medium text-primary hover:underline"
                onClick={() => updateState(emptySessionListState)}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!controls ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {sessionCount(sessions.length)}
        </p>
      ) : null}
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {sessions.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            No sessions match these filters. Clear filters to see the full program.
          </p>
        ) : (
          sessions.map((session) => {
            const isExpanded = expanded.includes(session.id);
            return (
              <article key={session.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/e/$eventSlug/sessions/$code"
                    params={{ eventSlug: program.event.slug, code: session.code }}
                    className="pressable min-w-0 text-sm font-medium hover:underline"
                  >
                    {session.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {session.code}
                    </span>
                    {(options?.showAddToCalendar ?? true) ? (
                      <ScheduleAction
                        session={session}
                        selected={schedule.selectedIds.includes(session.id)}
                        onToggle={() => schedule.toggle(session.id)}
                        className="-my-0.5 size-6"
                      />
                    ) : null}
                  </div>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3Icon className="size-3" />
                    {dateTimeRange(session, program.event.timezone, options?.dateFormat ?? "12h")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3" /> {session.roomName}
                  </span>
                </p>
                <div className="mt-2 grid gap-0.5">
                  {session.speakers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Speaker TBA</p>
                  ) : (
                    session.speakers.map((speaker) => (
                      <p key={speaker.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {publicSpeakerName(speaker)}
                        </span>
                        {" · "}
                        {speakerFallback(speaker)}
                      </p>
                    ))
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {session.tracks.map((track) => (
                    <TrackChip key={track.id} track={track} />
                  ))}
                  {(options?.showSessionFormat ?? true) ? <FormatChip session={session} /> : null}
                  {(options?.showSessionLevel ?? true) && session.level !== null ? (
                    <span className="text-[11px] text-muted-foreground">{session.level.name}</span>
                  ) : null}
                </div>
                {(options?.showSessionDescription ?? true) && session.description.trim() !== "" ? (
                  <div className="mt-2">
                    <div
                      className={cn(
                        "rte-content text-xs text-muted-foreground",
                        !isExpanded && "line-clamp-2",
                      )}
                      dangerouslySetInnerHTML={{ __html: session.description }}
                    />
                    <button
                      type="button"
                      className="pressable mt-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => setExpanded(toggleValue(expanded, session.id))}
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function Headshot({
  speaker,
  className,
}: {
  readonly speaker: PublicSpeaker;
  readonly className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = speaker.headshotUrl === null || failed;
  return fallback ? (
    <div
      aria-label={`${publicSpeakerName(speaker)} initials`}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground",
        className,
      )}
    >
      {speaker.firstName[0]}
      {speaker.lastName[0]}
    </div>
  ) : (
    <img
      src={speaker.headshotUrl ?? undefined}
      alt={publicSpeakerName(speaker)}
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-md object-cover", className)}
    />
  );
}

function SpeakerDetailDialog({
  program,
  entry,
  options,
  onClose,
}: {
  readonly program: PublicProgram;
  readonly entry: SpeakerEntry | null;
  readonly options?: WidgetOptions;
  readonly onClose: () => void;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          setBioExpanded(false);
          onClose();
        }
      }}
    >
      {entry === null ? null : (
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-8 text-left">
            <div className="flex items-start gap-3">
              <Headshot speaker={entry.speaker} className="size-16 text-base" />
              <div className="min-w-0">
                <DialogTitle className="text-base tracking-tight">
                  {publicSpeakerName(entry.speaker)}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  {speakerFallback(entry.speaker, options)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {(options?.showSpeakerBio ?? true) ? (
            <section>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Bio
              </h3>
              {entry.speaker.bio === null || entry.speaker.bio.trim() === "" ? (
                <p className="text-sm text-muted-foreground">Bio not provided.</p>
              ) : (
                <>
                  <div
                    className={cn(
                      "rte-content text-sm text-muted-foreground",
                      !bioExpanded && "line-clamp-3",
                    )}
                    dangerouslySetInnerHTML={{ __html: entry.speaker.bio }}
                  />
                  <button
                    type="button"
                    className="pressable mt-1.5 text-xs font-medium text-primary hover:underline"
                    onClick={() => setBioExpanded((value) => !value)}
                  >
                    {bioExpanded ? "Show less" : "Show more"}
                  </button>
                </>
              )}
            </section>
          ) : null}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sessions · {entry.sessions.length}
            </h3>
            <div className="divide-y overflow-hidden rounded-lg border">
              {entry.sessions.map((session) => (
                <Link
                  key={session.id}
                  to="/e/$eventSlug/sessions/$code"
                  params={{ eventSlug: program.event.slug, code: session.code }}
                  className="pressable block px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateTimeRange(session, program.event.timezone, options?.dateFormat ?? "12h")} ·{" "}
                    {session.roomName}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </DialogContent>
      )}
    </Dialog>
  );
}

function SpeakerSearch({
  value,
  onChange,
  count,
  total,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly count: number;
  readonly total: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="relative w-full max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 pl-8"
          placeholder="Search speakers…"
          aria-label="Search speakers by name"
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {count} of {total} speakers
      </p>
    </div>
  );
}

export function SpeakerList({
  program,
  options,
  search,
  onSearchChange,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly search?: string;
  readonly onSearchChange?: (value: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState("");
  const [selected, setSelected] = useState<SpeakerEntry | null>(null);
  const value = search ?? localSearch;
  const update = onSearchChange ?? setLocalSearch;
  const all = speakersFor(filterPublicProgram(program, options));
  const speakers = all.filter(({ speaker }) =>
    publicSpeakerName(speaker).toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()),
  );
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  return (
    <>
      <SpeakerSearch value={value} onChange={update} count={speakers.length} total={all.length} />
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {speakers.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            No speakers match this search.
          </p>
        ) : (
          speakers.map((entry) => (
            <button
              key={entry.speaker.id}
              type="button"
              onClick={() => setSelected(entry)}
              className="pressable flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <Headshot speaker={entry.speaker} className="size-10 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{publicSpeakerName(entry.speaker)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {speakerFallback(entry.speaker, options)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  {entry.sessions.length} {entry.sessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
      <SpeakerDetailDialog
        program={program}
        entry={selected}
        options={options}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

export function SpeakerGallery({
  program,
  options,
  search,
  onSearchChange,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly search?: string;
  readonly onSearchChange?: (value: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState("");
  const [selected, setSelected] = useState<SpeakerEntry | null>(null);
  const value = search ?? localSearch;
  const update = onSearchChange ?? setLocalSearch;
  const all = speakersFor(filterPublicProgram(program, options));
  const speakers = all.filter(({ speaker }) =>
    publicSpeakerName(speaker).toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()),
  );
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  return (
    <>
      <SpeakerSearch value={value} onChange={update} count={speakers.length} total={all.length} />
      {speakers.length === 0 ? (
        <p className="rounded-lg border px-3 py-10 text-center text-sm text-muted-foreground">
          No speakers match this search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {speakers.map((entry) => (
            <button
              key={entry.speaker.id}
              type="button"
              onClick={() => setSelected(entry)}
              className="pressable overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-muted/30"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <Headshot speaker={entry.speaker} className="size-full rounded-none text-2xl" />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium">{publicSpeakerName(entry.speaker)}</h3>
                <p className="mt-0.5 min-h-8 text-[11px] text-muted-foreground">
                  {speakerFallback(entry.speaker, options)}
                </p>
                <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground tabular-nums">
                  {entry.sessions.length} {entry.sessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      <SpeakerDetailDialog
        program={program}
        entry={selected}
        options={options}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function DaySwitcher({
  days,
  selected,
  sessions,
  timezone,
  onSelect,
}: {
  readonly days: ReadonlyArray<string>;
  readonly selected: string;
  readonly sessions: ReadonlyArray<PublicSession>;
  readonly timezone: string;
  readonly onSelect: (day: string) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-1">
      {days.map((day) => {
        const sample = sessions.find((item) => publicDateKey(item.startsAt, timezone) === day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected === day}
            onClick={() => onSelect(day)}
            className={cn(
              "pressable rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selected === day
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {sample === undefined ? day : dayLabel(sample.startsAt, timezone)}
          </button>
        );
      })}
    </div>
  );
}

function SessionDialog({
  program,
  session,
  options,
  onClose,
}: {
  readonly program: PublicProgram;
  readonly session: PublicSession | null;
  readonly options?: WidgetOptions;
  readonly onClose: () => void;
}) {
  const schedule = usePersonalSchedule(program);
  return (
    <Dialog open={session !== null} onOpenChange={(open) => !open && onClose()}>
      {session === null ? null : (
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-8 text-left">
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {session.code}
            </p>
            <DialogTitle className="text-base leading-snug tracking-tight">
              {session.title}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>{dateTimeRange(session, program.event.timezone, options?.dateFormat)}</span>
              <span>{session.roomName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            {session.tracks.map((track) => (
              <TrackChip key={track.id} track={track} />
            ))}
            {(options?.showSessionFormat ?? true) ? <FormatChip session={session} /> : null}
            {(options?.showAddToCalendar ?? true) ? (
              <ScheduleAction
                session={session}
                selected={schedule.selectedIds.includes(session.id)}
                onToggle={() => schedule.toggle(session.id)}
                className="ml-auto"
              />
            ) : null}
          </div>
          {(options?.showSessionDescription ?? true) ? (
            <div
              className="rte-content text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: session.description }}
            />
          ) : null}
          <div className="border-t pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Speakers
            </p>
            <div className="mt-2 grid gap-1.5">
              {session.speakers.map((speaker) => (
                <p key={speaker.id} className="text-xs">
                  <span className="font-medium">{publicSpeakerName(speaker)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {speakerFallback(speaker, options)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function Agenda({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const sessions = filterPublicProgram(program, options).sessions;
  const days = uniqueDays(sessions, program.event.timezone);
  const [selectedDay, setSelectedDay] = useState(days[0] ?? "");
  const [detail, setDetail] = useState<PublicSession | null>(null);
  const schedule = usePersonalSchedule(program);
  if (program.event.agendaPublishedAt === null) return <EmptyProgram agenda />;
  const current = sessions.filter(
    (session) => publicDateKey(session.startsAt, program.event.timezone) === selectedDay,
  );
  const groups = new Map<string, Array<PublicSession>>();
  for (const session of current)
    groups.set(session.startsAt, [...(groups.get(session.startsAt) ?? []), session]);
  return (
    <>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DaySwitcher
            days={days}
            selected={selectedDay}
            sessions={sessions}
            timezone={program.event.timezone}
            onSelect={setSelectedDay}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {current.length} {current.length === 1 ? "session" : "sessions"}
          </p>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {Array.from(groups, ([startsAt, group]) => (
            <div key={startsAt} className="grid grid-cols-[82px_1fr] gap-3 px-3 py-3">
              <div className="text-xs tabular-nums">
                <p className="font-medium">
                  {timeLabel(startsAt, program.event.timezone, options?.dateFormat ?? "12h")}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {timeLabel(
                    group[0]?.endsAt ?? startsAt,
                    program.event.timezone,
                    options?.dateFormat ?? "12h",
                  )}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.map((session) => (
                  <article
                    key={session.id}
                    className="relative min-w-0 border-l-2 pl-2"
                    style={{ borderLeftColor: session.tracks[0]?.color }}
                  >
                    <button
                      type="button"
                      onClick={() => setDetail(session)}
                      className={cn(
                        "pressable block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                        (options?.showAddToCalendar ?? true) && "pr-10",
                      )}
                    >
                      <p className="text-sm font-medium">{session.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {session.speakers.map(publicSpeakerName).join(", ") || "Speaker TBA"}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {session.roomName} ·{" "}
                        {[...session.tracks.map((track) => track.name), session.format?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                    {(options?.showAddToCalendar ?? true) ? (
                      <ScheduleAction
                        session={session}
                        selected={schedule.selectedIds.includes(session.id)}
                        onToggle={() => schedule.toggle(session.id)}
                        className="absolute top-2 right-1"
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SessionDialog
        program={program}
        session={detail}
        options={options}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

export function Itinerary({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const schedule = usePersonalSchedule(program);
  // Persisted per event so a remount (embed reload, navigation) never silently
  // bounces the visitor from My Schedule back to All sessions.
  const viewKey = `opensesh-itinerary-view:${program.event.id}`;
  const [mineOnly, setMineOnlyState] = useState(false);
  useEffect(() => {
    setMineOnlyState(window.sessionStorage.getItem(viewKey) === "mine");
  }, [viewKey]);
  const setMineOnly = (value: boolean) => {
    setMineOnlyState(value);
    window.sessionStorage.setItem(viewKey, value ? "mine" : "all");
  };
  const [expanded, setExpanded] = useState<ReadonlyArray<string>>([]);
  const base = filterPublicProgram(program, options).sessions;
  const sessions = mineOnly
    ? base.filter((session) => schedule.selectedIds.includes(session.id))
    : base;
  if (program.event.agendaPublishedAt === null) return <EmptyProgram agenda />;
  return (
    <div className="grid gap-5">
      {(options?.showAddToCalendar ?? true) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1">
            <button
              type="button"
              aria-pressed={!mineOnly}
              onClick={() => setMineOnly(false)}
              className={cn(
                "pressable rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !mineOnly ? "bg-background text-foreground" : "text-muted-foreground",
              )}
            >
              All sessions
            </button>
            <button
              type="button"
              aria-pressed={mineOnly}
              onClick={() => setMineOnly(true)}
              className={cn(
                "pressable rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mineOnly ? "bg-background text-foreground" : "text-muted-foreground",
              )}
            >
              My Schedule ({schedule.selectedIds.length})
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            disabled={!schedule.ready || schedule.selectedIds.length === 0}
            onClick={() => void downloadSchedule(program, schedule.selectedIds)}
          >
            <DownloadIcon /> Export ICS
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground tabular-nums">
          {sessionCount(sessions.length)}
        </p>
      )}
      {sessions.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center">
          <StarIcon className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">My Schedule is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add sessions with the star button, then return here to export them.
          </p>
        </div>
      ) : (
        uniqueDays(sessions, program.event.timezone).map((day) => {
          const current = sessions.filter(
            (item) => publicDateKey(item.startsAt, program.event.timezone) === day,
          );
          return (
            <section key={day}>
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {current[0] === undefined
                  ? day
                  : dayLabel(current[0].startsAt, program.event.timezone, true)}
              </h2>
              <div className="divide-y overflow-hidden rounded-lg border bg-card">
                {current.map((session) => {
                  const isExpanded = expanded.includes(session.id);
                  return (
                    <article key={session.id} className="px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-sm font-medium">{session.title}</h3>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {session.code}
                          </span>
                          {(options?.showAddToCalendar ?? true) ? (
                            <ScheduleAction
                              session={session}
                              selected={schedule.selectedIds.includes(session.id)}
                              onToggle={() => schedule.toggle(session.id)}
                              className="-my-0.5 size-6 print:hidden"
                            />
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dateTimeRange(session, program.event.timezone, options?.dateFormat)}
                        {" · "}
                        {session.roomName}
                      </p>
                      <div className="mt-2 grid gap-0.5">
                        {session.speakers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Speaker TBA</p>
                        ) : (
                          session.speakers.map((speaker) => (
                            <p key={speaker.id} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {publicSpeakerName(speaker)}
                              </span>
                              {speakerFallback(speaker, options) === ""
                                ? ""
                                : ` · ${speakerFallback(speaker, options)}`}
                            </p>
                          ))
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {session.tracks.map((track) => (
                          <TrackChip key={track.id} track={track} />
                        ))}
                        {(options?.showSessionFormat ?? true) ? (
                          <FormatChip session={session} />
                        ) : null}
                      </div>
                      {(options?.showSessionDescription ?? true) &&
                      session.description.trim() !== "" ? (
                        <div className="mt-2">
                          <div
                            className={cn(
                              "rte-content text-xs text-muted-foreground",
                              !isExpanded && "line-clamp-2",
                            )}
                            dangerouslySetInnerHTML={{ __html: session.description }}
                          />
                          <button
                            type="button"
                            className="pressable mt-1 text-xs font-medium text-primary hover:underline print:hidden"
                            onClick={() => setExpanded(toggleValue(expanded, session.id))}
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

export function ProgramView({
  view,
  program,
  options,
  sessionControls = false,
  sessionState,
  onSessionStateChange,
  speakerSearch,
  onSpeakerSearchChange,
}: {
  readonly view: WidgetView;
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly sessionControls?: boolean;
  readonly sessionState?: SessionListState;
  readonly onSessionStateChange?: (state: SessionListState) => void;
  readonly speakerSearch?: string;
  readonly onSpeakerSearchChange?: (value: string) => void;
}) {
  if (view === "sessions")
    return (
      <SessionList
        program={program}
        options={options}
        controls={sessionControls}
        state={sessionState}
        onStateChange={onSessionStateChange}
      />
    );
  if (view === "speakers")
    return (
      <SpeakerList
        program={program}
        options={options}
        search={speakerSearch}
        onSearchChange={onSpeakerSearchChange}
      />
    );
  if (view === "speaker_gallery")
    return (
      <SpeakerGallery
        program={program}
        options={options}
        search={speakerSearch}
        onSearchChange={onSpeakerSearchChange}
      />
    );
  if (view === "agenda") return <Agenda program={program} options={options} />;
  return <Itinerary program={program} options={options} />;
}

export function SessionDetail({
  program,
  session,
}: {
  readonly program: PublicProgram;
  readonly session: PublicSession;
}) {
  const schedule = usePersonalSchedule(program);
  return (
    <article className="grid gap-6">
      <div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">{session.code}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{session.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.tracks.map((track) => (
            <TrackChip key={track.id} track={track} />
          ))}
          <FormatChip session={session} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-y py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3Icon className="size-3.5" />
          {dateTimeRange(session, program.event.timezone)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPinIcon className="size-3.5" /> {session.roomName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ScheduleAction
            session={session}
            selected={schedule.selectedIds.includes(session.id)}
            onToggle={() => schedule.toggle(session.id)}
          />
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            onClick={() => void downloadIcs(program, session)}
          >
            <CalendarPlusIcon /> Add to calendar
          </Button>
        </div>
      </div>
      <div
        className="rte-content text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: session.description }}
      />
      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Speakers
        </h2>
        <div className="divide-y overflow-hidden rounded-lg border">
          {session.speakers.map((speaker) => (
            <div key={speaker.id} className="flex gap-3 p-3">
              <Headshot speaker={speaker} className="size-10 text-xs" />
              <div>
                <p className="text-sm font-medium">{publicSpeakerName(speaker)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{speakerFallback(speaker)}</p>
                {speaker.bio === null ? null : (
                  <div
                    className="rte-content mt-2 text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: speaker.bio }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

const downloadIcs = async (program: PublicProgram, session: PublicSession) => {
  const result = await downloadPublicSessionIcs({
    data: { eventSlug: program.event.slug, code: session.code },
  });
  if (!result.ok) return;
  downloadFile(result.data.filename, result.data.content);
};

const downloadSchedule = async (program: PublicProgram, sessionIds: ReadonlyArray<string>) => {
  const result = await downloadPersonalScheduleIcs({
    data: { eventSlug: program.event.slug, sessionIds: [...sessionIds] },
  });
  if (!result.ok) return;
  downloadFile(result.data.filename, result.data.content);
};

const downloadFile = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
