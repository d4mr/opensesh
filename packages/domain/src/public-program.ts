import type {
  PublicProgram,
  PublicSession,
  WidgetOptions,
  WidgetView,
} from "./server/schema/widgets";

export interface PublicSessionFilters {
  readonly search?: string;
  readonly trackIds?: ReadonlyArray<string>;
  readonly formatIds?: ReadonlyArray<string>;
  readonly tagIds?: ReadonlyArray<string>;
  readonly roomNames?: ReadonlyArray<string>;
  readonly dayKeys?: ReadonlyArray<string>;
  readonly timezone: string;
}

export const publicDateKey = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

export const publicSpeakerName = (speaker: PublicSession["speakers"][number]) =>
  `${speaker.firstName} ${speaker.lastName}`;

export const sessionMatchesSearch = (session: PublicSession, search: string) => {
  const needle = search.trim().toLocaleLowerCase();
  return (
    needle === "" ||
    [session.title, ...session.speakers.map(publicSpeakerName)]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle)
  );
};

export const filterPublicSessions = (
  sessions: ReadonlyArray<PublicSession>,
  filters: PublicSessionFilters,
) =>
  sessions.filter(
    (session) =>
      sessionMatchesSearch(session, filters.search ?? "") &&
      ((filters.trackIds?.length ?? 0) === 0 ||
        session.tracks.some((track) => filters.trackIds?.includes(track.id) === true)) &&
      ((filters.formatIds?.length ?? 0) === 0 ||
        (session.format !== null && filters.formatIds?.includes(session.format.id) === true)) &&
      ((filters.tagIds?.length ?? 0) === 0 ||
        session.tags.some((tag) => filters.tagIds?.includes(tag.id) === true)) &&
      ((filters.roomNames?.length ?? 0) === 0 ||
        filters.roomNames?.includes(session.roomName) === true) &&
      ((filters.dayKeys?.length ?? 0) === 0 ||
        filters.dayKeys?.includes(publicDateKey(session.startsAt, filters.timezone)) === true),
  );

export const filterPublicProgram = (program: PublicProgram, options?: WidgetOptions) => ({
  ...program,
  sessions:
    options === undefined
      ? program.sessions
      : filterPublicSessions(program.sessions, {
          timezone: program.event.timezone,
          trackIds: options.trackIds,
          formatIds: options.formatIds,
          tagIds: options.tagIds,
        }),
});

export const serializePersonalSchedule = (sessionIds: ReadonlyArray<string>) =>
  JSON.stringify(Array.from(new Set(sessionIds)));

export const restorePersonalSchedule = (value: string | null): ReadonlyArray<string> => {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((item): item is string => typeof item === "string")))
      : [];
  } catch {
    return [];
  }
};

export const publicSessionSnapshot = (session: PublicSession) => ({
  title: session.title,
  description: session.description,
  startsAt: session.startsAt,
  endsAt: session.endsAt,
  roomName: session.roomName,
  tracks: session.tracks.map(({ id, name }) => ({ id, name })),
  format: session.format === null ? null : { id: session.format.id, name: session.format.name },
  speakers: session.speakers.map(({ id, firstName, lastName, title, company }) => ({
    id,
    firstName,
    lastName,
    title,
    company,
  })),
});

export const serializePublicView = (
  program: PublicProgram,
  _view: WidgetView,
  options?: WidgetOptions,
) => filterPublicProgram(program, options).sessions.map(publicSessionSnapshot);
