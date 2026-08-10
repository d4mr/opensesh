import type {
  PublicProgram,
  PublicSession,
  PublicSpeaker,
  WidgetOptions,
  WidgetView,
} from "@opensesh/domain";
import { Link } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  Clock3Icon,
  MapPinIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadPublicSessionIcs } from "@/server-fns/widgets";

const fullName = (speaker: PublicSpeaker) => `${speaker.firstName} ${speaker.lastName}`;
const dateKey = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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

export const speakersFor = (program: PublicProgram) => {
  const map = new Map<string, { speaker: PublicSpeaker; sessions: Array<PublicSession> }>();
  for (const session of program.sessions) {
    for (const speaker of session.speakers) {
      const entry = map.get(speaker.id) ?? { speaker, sessions: [] };
      entry.sessions.push(session);
      map.set(speaker.id, entry);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.speaker.lastName.localeCompare(b.speaker.lastName),
  );
};

const filteredSessions = (program: PublicProgram, options?: WidgetOptions) =>
  options === undefined
    ? program.sessions
    : program.sessions.filter(
        (session) =>
          (options.trackIds.length === 0 ||
            session.tracks.some((item) => options.trackIds.includes(item.id))) &&
          (options.formatIds.length === 0 ||
            (session.format !== null && options.formatIds.includes(session.format.id))) &&
          (options.tagIds.length === 0 ||
            session.tags.some((item) => options.tagIds.includes(item.id))),
      );

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

export function SessionList({
  program,
  options,
  controls = true,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly controls?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [formatId, setFormatId] = useState<string | null>(null);
  const base = filteredSessions(program, options);
  const sessions = base.filter((session) => {
    if (trackId !== null && !session.tracks.some((item) => item.id === trackId)) return false;
    if (formatId !== null && session.format?.id !== formatId) return false;
    const needle = search.trim().toLowerCase();
    return (
      needle === "" ||
      [session.title, session.code, ...session.speakers.map(fullName)]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  });
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  return (
    <div className="grid gap-4">
      {controls ? (
        <>
          <div className="relative max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 pl-8"
              placeholder="Search sessions…"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={trackId === null} onClick={() => setTrackId(null)}>
              All tracks
            </FilterChip>
            {program.tracks.map((track) => (
              <FilterChip
                key={track.id}
                active={trackId === track.id}
                onClick={() => setTrackId(track.id)}
              >
                {track.name}
              </FilterChip>
            ))}
            <span className="mx-1 h-6 border-l" />
            <FilterChip active={formatId === null} onClick={() => setFormatId(null)}>
              All formats
            </FilterChip>
            {program.formats.map((format) => (
              <FilterChip
                key={format.id}
                active={formatId === format.id}
                onClick={() => setFormatId(format.id)}
              >
                {format.name}
              </FilterChip>
            ))}
          </div>
        </>
      ) : null}
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {sessions.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            No sessions match these filters.
          </p>
        ) : (
          sessions.map((session) => (
            <article key={session.id} className="relative">
              <Link
                to="/e/$eventSlug/sessions/$code"
                params={{ eventSlug: program.event.slug, code: session.code }}
                className={cn(
                  "pressable block px-3 py-3 text-left transition-colors hover:bg-muted/50",
                  options?.showAddToCalendar === true && "pr-12",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{session.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.speakers.map(fullName).join(", ") || "Speaker TBA"}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {session.code}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {session.tracks.map((track) => (
                    <TrackChip key={track.id} track={track} />
                  ))}
                  {(options?.showSessionFormat ?? true) && session.format !== null ? (
                    <span className="text-[11px] text-muted-foreground">{session.format.name}</span>
                  ) : null}
                  {(options?.showSessionLevel ?? true) && session.level !== null ? (
                    <span className="text-[11px] text-muted-foreground">
                      · {session.level.name}
                    </span>
                  ) : null}
                </div>
                {(options?.showSessionDescription ?? false) ? (
                  <div
                    className="rte-content mt-2 line-clamp-2 text-xs text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: session.description }}
                  />
                ) : null}
              </Link>
              {options?.showAddToCalendar === true ? (
                <CalendarAction
                  program={program}
                  session={session}
                  className="absolute top-2.5 right-2.5"
                />
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
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

function Headshot({
  speaker,
  large = false,
}: {
  readonly speaker: PublicSpeaker;
  readonly large?: boolean;
}) {
  const size = large ? "size-20 text-lg" : "size-10 text-xs";
  return speaker.headshotUrl === null ? (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold",
        size,
      )}
    >
      {speaker.firstName[0]}
      {speaker.lastName[0]}
    </div>
  ) : (
    <img
      src={speaker.headshotUrl}
      alt=""
      className={cn("shrink-0 rounded-md object-cover", size)}
    />
  );
}

export function SpeakerList({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const filtered = { ...program, sessions: filteredSessions(program, options) };
  const speakers = speakersFor(filtered);
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {speakers.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          No speakers are published yet.
        </p>
      ) : (
        speakers.map(({ speaker, sessions }) => (
          <article key={speaker.id} className="flex gap-3 px-3 py-3">
            <Headshot speaker={speaker} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{fullName(speaker)}</p>
              {(options?.showSpeakerTitle ?? true) || (options?.showSpeakerCompany ?? true) ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    (options?.showSpeakerTitle ?? true) ? speaker.title : null,
                    (options?.showSpeakerCompany ?? true) ? speaker.company : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    to="/e/$eventSlug/sessions/$code"
                    params={{ eventSlug: program.event.slug, code: session.code }}
                    className="pressable text-xs font-medium text-primary hover:underline"
                  >
                    {session.title}
                  </Link>
                ))}
              </div>
              {(options?.showSpeakerBio ?? false) && speaker.bio !== null ? (
                <div
                  className="rte-content mt-2 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: speaker.bio }}
                />
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export function SpeakerGallery({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const filtered = { ...program, sessions: filteredSessions(program, options) };
  const speakers = speakersFor(filtered);
  if (program.event.agendaPublishedAt === null) return <EmptyProgram />;
  if (speakers.length === 0) return <EmptyProgram />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {speakers.map(({ speaker, sessions }) => (
        <article key={speaker.id} className="group overflow-hidden rounded-lg border bg-card">
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            {speaker.headshotUrl === null ? (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {speaker.firstName[0]}
                {speaker.lastName[0]}
              </div>
            ) : (
              <img
                src={speaker.headshotUrl}
                alt=""
                className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            )}
          </div>
          <div className="p-3">
            <h3 className="text-sm font-medium">{fullName(speaker)}</h3>
            <p className="mt-0.5 min-h-4 text-[11px] text-muted-foreground">
              {[
                (options?.showSpeakerTitle ?? true) ? speaker.title : null,
                (options?.showSpeakerCompany ?? true) ? speaker.company : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 border-t pt-2 opacity-80 transition-opacity group-hover:opacity-100">
              {sessions.map((session) => (
                <p key={session.id} className="line-clamp-1 text-[11px] font-medium text-primary">
                  {session.title}
                </p>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Agenda({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const sessions = filteredSessions(program, options);
  const days = uniqueDays(sessions, program.event.timezone);
  const [selected, setSelected] = useState(days[0] ?? "");
  if (program.event.agendaPublishedAt === null) return <EmptyProgram agenda />;
  const current = sessions.filter(
    (session) => dateKey(session.startsAt, program.event.timezone) === selected,
  );
  const groups = new Map<string, Array<PublicSession>>();
  for (const session of current)
    groups.set(session.startsAt, [...(groups.get(session.startsAt) ?? []), session]);
  return (
    <div className="grid gap-4">
      <DaySwitcher
        days={days}
        selected={selected}
        sessions={sessions}
        timezone={program.event.timezone}
        onSelect={setSelected}
      />
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
                <AgendaRoomSession
                  key={session.id}
                  session={session}
                  program={program}
                  options={options}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const uniqueDays = (sessions: ReadonlyArray<PublicSession>, timezone: string) =>
  Array.from(new Set(sessions.map((session) => dateKey(session.startsAt, timezone))));
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
        const sample = sessions.find((item) => dateKey(item.startsAt, timezone) === day);
        return (
          <button
            key={day}
            type="button"
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
function AgendaRoomSession({
  session,
  program,
  options,
}: {
  readonly session: PublicSession;
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  return (
    <div
      className="relative min-w-0 border-l-2 pl-2"
      style={{ borderLeftColor: session.tracks[0]?.color }}
    >
      <Link
        to="/e/$eventSlug/sessions/$code"
        params={{ eventSlug: program.event.slug, code: session.code }}
        className={cn(
          "pressable block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50",
          options?.showAddToCalendar === true && "pr-12",
        )}
      >
        <p className="text-sm font-medium">{session.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {session.speakers.map(fullName).join(", ") || "Speaker TBA"}
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {session.roomName}
          {session.tracks.length === 0
            ? ""
            : ` · ${session.tracks.map((track) => track.name).join(", ")}`}
        </p>
      </Link>
      {options?.showAddToCalendar === true ? (
        <CalendarAction
          program={program}
          session={session}
          className="absolute top-2.5 right-2.5"
        />
      ) : null}
    </div>
  );
}

export function Itinerary({
  program,
  options,
}: {
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
}) {
  const sessions = filteredSessions(program, options);
  if (program.event.agendaPublishedAt === null) return <EmptyProgram agenda />;
  return (
    <div className="grid gap-6">
      {uniqueDays(sessions, program.event.timezone).map((day) => {
        const current = sessions.filter(
          (item) => dateKey(item.startsAt, program.event.timezone) === day,
        );
        return (
          <section key={day}>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {current[0] === undefined
                ? day
                : dayLabel(current[0].startsAt, program.event.timezone, true)}
            </h2>
            <div className="grid gap-2">
              {current.map((session) => (
                <article
                  key={session.id}
                  className={cn(
                    "relative grid grid-cols-[86px_1fr] gap-3 rounded-lg border bg-card px-3 py-3 break-inside-avoid",
                    options?.showAddToCalendar === true && "pr-12",
                  )}
                >
                  <p className="text-xs font-medium tabular-nums">
                    {timeLabel(
                      session.startsAt,
                      program.event.timezone,
                      options?.dateFormat ?? "12h",
                    )}
                  </p>
                  <div>
                    <h3 className="text-sm font-medium">{session.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.roomName} ·{" "}
                      {session.speakers.map(fullName).join(", ") || "Speaker TBA"}
                    </p>
                  </div>
                  {options?.showAddToCalendar === true ? (
                    <CalendarAction
                      program={program}
                      session={session}
                      className="absolute top-2 right-2 print:hidden"
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ProgramView({
  view,
  program,
  options,
  sessionControls = false,
}: {
  readonly view: WidgetView;
  readonly program: PublicProgram;
  readonly options?: WidgetOptions;
  readonly sessionControls?: boolean;
}) {
  if (view === "sessions")
    return <SessionList program={program} options={options} controls={sessionControls} />;
  if (view === "speakers") return <SpeakerList program={program} options={options} />;
  if (view === "speaker_gallery") return <SpeakerGallery program={program} options={options} />;
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
  return (
    <article className="grid gap-6">
      <div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">{session.code}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{session.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.tracks.map((track) => (
            <TrackChip key={track.id} track={track} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-y py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3Icon className="size-3.5" />
          {dayLabel(session.startsAt, program.event.timezone, true)},{" "}
          {timeLabel(session.startsAt, program.event.timezone, "12h")}–
          {timeLabel(session.endsAt, program.event.timezone, "12h")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPinIcon className="size-3.5" />
          {session.roomName}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="pressable ml-auto"
          onClick={() => void downloadIcs(program, session)}
        >
          <CalendarPlusIcon /> Add to calendar
        </Button>
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
              <Headshot speaker={speaker} />
              <div>
                <p className="text-sm font-medium">{fullName(speaker)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[speaker.title, speaker.company].filter(Boolean).join(" · ")}
                </p>
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
  const url = URL.createObjectURL(
    new Blob([result.data.content], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.data.filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function CalendarAction({
  program,
  session,
  className,
}: {
  readonly program: PublicProgram;
  readonly session: PublicSession;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Add ${session.title} to calendar`}
      title="Add to calendar"
      onClick={() => void downloadIcs(program, session)}
      className={cn(
        "pressable flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <CalendarPlusIcon className="size-3.5" />
    </button>
  );
}
