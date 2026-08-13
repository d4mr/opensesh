import type {
  AgendaAdminData,
  AgendaDraftCriteria,
  AgendaDraftPlacement,
  AgendaDraftProposal,
  AgendaSession,
} from "../server/schema/agenda";
import { detectAgendaConflicts } from "./conflicts";
import { validateScheduleChange } from "./schedule";

const START_MINUTES = 8 * 60;
const END_MINUTES = 19 * 60;
const SLOT_MINUTES = 15;

export interface AgendaSolverInput {
  readonly agenda: AgendaAdminData;
  readonly criteria: AgendaDraftCriteria;
}

const zonedParts = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? Number.NaN);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
};

const dateKeyFor = (value: string, timezone: string) => {
  const parts = zonedParts(value, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const zonedDateTimeIso = (dateKey: string, minutes: number, timezone: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const desired = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, minute);
  let guess = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(new Date(guess).toISOString(), timezone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
};

const sessionDuration = (session: AgendaSession) =>
  session.startsAt === null || session.endsAt === null
    ? session.durationMinutes
    : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000);

const completeCurrentPlacement = (session: AgendaSession): AgendaDraftPlacement | null =>
  session.roomId === null || session.startsAt === null || session.endsAt === null
    ? null
    : {
        submissionId: session.id,
        roomId: session.roomId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        reason: "Kept existing placement.",
      };

const scheduledSession = (
  session: AgendaSession,
  placement: AgendaDraftPlacement,
): AgendaSession => ({
  ...session,
  roomId: placement.roomId,
  startsAt: placement.startsAt,
  endsAt: placement.endsAt,
});

const formatWeight = (session: AgendaSession) => {
  const format = session.formatName?.toLowerCase() ?? "";
  if (format.includes("keynote")) return 0;
  if (format.includes("workshop")) return 1;
  if (format.includes("talk")) return 2;
  if (format.includes("lightning")) return 3;
  return 4;
};

const interleaveByTrack = (sessions: ReadonlyArray<AgendaSession>) => {
  const result: Array<AgendaSession> = [];
  const weights = [...new Set(sessions.map(formatWeight))].sort((left, right) => left - right);
  for (const weight of weights) {
    const queues = new Map<string, Array<AgendaSession>>();
    for (const session of sessions
      .filter((item) => formatWeight(item) === weight)
      .sort((left, right) => left.code.localeCompare(right.code))) {
      const track = session.tracks[0]?.id ?? "untracked";
      queues.set(track, [...(queues.get(track) ?? []), session]);
    }
    const trackIds = [...queues.keys()].sort();
    while (trackIds.some((trackId) => (queues.get(trackId)?.length ?? 0) > 0)) {
      for (const trackId of trackIds) {
        const next = queues.get(trackId)?.shift();
        if (next !== undefined) result.push(next);
      }
    }
  }
  return result;
};

const normalizedReason = (reason: string) =>
  reason.trim().replaceAll(/\s+/g, " ").slice(0, 180) || "Conflict-free placement.";

// The preferred daily window narrows placements inside the app-wide
// 8:00–19:00 canvas; absent keys mean the full canvas, and clamping means
// malformed criteria can never widen it.
export const dayWindow = (criteria: AgendaDraftCriteria) => {
  const start = Math.min(
    Math.max(criteria.dayStartMinutes ?? START_MINUTES, START_MINUTES),
    END_MINUTES - SLOT_MINUTES,
  );
  const end = Math.max(
    Math.min(criteria.dayEndMinutes ?? END_MINUTES, END_MINUTES),
    start + SLOT_MINUTES,
  );
  return { start, end };
};

const keynoteRoom = (input: AgendaSolverInput) => {
  for (const rule of input.criteria.rules) {
    const match = /keynotes?.*?\bin\s+(.+?)(?:\s+(?:morning|afternoon|evening)\b|$)/i.exec(rule);
    const requested = match?.[1]?.trim().toLowerCase();
    if (requested === undefined) continue;
    const room = input.agenda.rooms.find((item) => item.name.toLowerCase() === requested);
    if (room !== undefined && input.criteria.roomIds.includes(room.id)) return room;
  }
  return undefined;
};

const workshopStart = (criteria: AgendaDraftCriteria, fallback: number) => {
  for (const rule of criteria.rules) {
    const match = /no workshops? before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(rule);
    if (match === null) continue;
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? "0");
    const period = match[3]?.toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return Math.max(hour * 60 + minute, fallback);
  }
  return fallback;
};

const hasRule = (criteria: AgendaDraftCriteria, pattern: RegExp) =>
  criteria.rules.some((rule) => pattern.test(rule));

const isCandidateLegal = (
  input: AgendaSolverInput,
  session: AgendaSession,
  placement: AgendaDraftPlacement,
  occupied: ReadonlyArray<AgendaSession>,
  allowOutsideCriteria: boolean,
) => {
  const roomIds = allowOutsideCriteria
    ? input.agenda.rooms.map((room) => room.id)
    : input.criteria.roomIds;
  const validation = validateScheduleChange(placement, {
    timezone: input.agenda.event.timezone,
    startsAt: input.agenda.event.startsAt,
    endsAt: input.agenda.event.endsAt,
    roomIds,
  });
  if (validation !== null) return false;
  if (
    !allowOutsideCriteria &&
    !input.criteria.days.includes(dateKeyFor(placement.startsAt, input.agenda.event.timezone))
  ) {
    return false;
  }
  if (
    Date.parse(placement.endsAt) - Date.parse(placement.startsAt) !==
    sessionDuration(session) * 60_000
  ) {
    return false;
  }
  if (!allowOutsideCriteria) {
    const window = dayWindow(input.criteria);
    const timezone = input.agenda.event.timezone;
    const startParts = zonedParts(placement.startsAt, timezone);
    const endParts = zonedParts(placement.endsAt, timezone);
    if (
      startParts.hour * 60 + startParts.minute < window.start ||
      endParts.hour * 60 + endParts.minute > window.end
    ) {
      return false;
    }
  }
  return detectAgendaConflicts([...occupied, scheduledSession(session, placement)]).length === 0;
};

const orderedDays = (
  input: AgendaSolverInput,
  session: AgendaSession,
  occupied: ReadonlyArray<AgendaSession>,
) => {
  const days = [...input.criteria.days].sort();
  if (!hasRule(input.criteria, /spread\s+(?:each\s+)?track/i) || session.tracks.length === 0) {
    return days;
  }
  const trackIds = new Set(session.tracks.map((track) => track.id));
  const counts = new Map(days.map((day) => [day, 0]));
  for (const item of occupied) {
    if (item.startsAt === null || !item.tracks.some((track) => trackIds.has(track.id))) continue;
    const day = dateKeyFor(item.startsAt, input.agenda.event.timezone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return days.sort((left, right) => (counts.get(left) ?? 0) - (counts.get(right) ?? 0));
};

const findPlacement = (
  input: AgendaSolverInput,
  session: AgendaSession,
  occupied: ReadonlyArray<AgendaSession>,
  repaired: boolean,
): AgendaDraftPlacement | null => {
  const format = session.formatName?.toLowerCase() ?? "";
  const isKeynote = format.includes("keynote");
  const isWorkshop = format.includes("workshop");
  const preferredKeynoteRoom = isKeynote ? keynoteRoom(input) : undefined;
  const availableRooms = input.criteria.roomIds
    .flatMap((id) => {
      const room = input.agenda.rooms.find((item) => item.id === id);
      return room === undefined ? [] : [room];
    })
    .sort((left, right) => {
      if (left.id === preferredKeynoteRoom?.id) return -1;
      if (right.id === preferredKeynoteRoom?.id) return 1;
      return left.position - right.position;
    });
  const rooms = preferredKeynoteRoom === undefined ? availableRooms : [preferredKeynoteRoom];
  const window = dayWindow(input.criteria);
  const earliest = isWorkshop ? workshopStart(input.criteria, window.start) : window.start;
  const morning = isKeynote && hasRule(input.criteria, /keynotes?.*morning/i);
  const duration = sessionDuration(session);
  const reason = repaired
    ? "Repaired by validation gate: earliest conflict-free slot."
    : preferredKeynoteRoom !== undefined && morning
      ? `Keynote placed in ${preferredKeynoteRoom.name} in the morning.`
      : isWorkshop && earliest > window.start
        ? `Workshop placed after ${Math.floor(earliest / 60)}:${String(earliest % 60).padStart(2, "0")}.`
        : "Earliest conflict-free slot, interleaved by track.";

  for (const day of orderedDays(input, session, occupied)) {
    const latestStart = morning
      ? Math.min(12 * 60 - duration, window.end - duration)
      : window.end - duration;
    for (let minutes = earliest; minutes <= latestStart; minutes += SLOT_MINUTES) {
      for (const room of rooms) {
        const startsAt = zonedDateTimeIso(day, minutes, input.agenda.event.timezone);
        const placement = {
          submissionId: session.id,
          roomId: room.id,
          startsAt,
          endsAt: new Date(Date.parse(startsAt) + duration * 60_000).toISOString(),
          reason,
        };
        if (isCandidateLegal(input, session, placement, occupied, false)) return placement;
      }
    }
  }
  return null;
};

const buildProposal = (
  input: AgendaSolverInput,
  proposed: AgendaDraftProposal,
  validationGate: boolean,
): AgendaDraftProposal | null => {
  if (input.criteria.days.length === 0 || input.criteria.roomIds.length === 0) return null;
  const proposedById = new Map<string, AgendaDraftPlacement>();
  for (const placement of proposed.placements) {
    if (!proposedById.has(placement.submissionId))
      proposedById.set(placement.submissionId, placement);
  }

  const preferred = [...input.agenda.sessions].sort((left, right) => {
    const leftKept =
      input.criteria.respectExistingPlacements && completeCurrentPlacement(left) !== null;
    const rightKept =
      input.criteria.respectExistingPlacements && completeCurrentPlacement(right) !== null;
    if (leftKept !== rightKept) return leftKept ? -1 : 1;
    return left.code.localeCompare(right.code);
  });
  const occupied: Array<AgendaSession> = [];
  const placements = new Map<string, AgendaDraftPlacement>();
  const deferred: Array<AgendaSession> = [];

  for (const session of preferred) {
    const current = completeCurrentPlacement(session);
    const desired =
      input.criteria.respectExistingPlacements && current !== null
        ? current
        : proposedById.get(session.id);
    const allowOutsideCriteria = input.criteria.respectExistingPlacements && desired === current;
    if (
      desired !== undefined &&
      desired !== null &&
      desired.submissionId === session.id &&
      isCandidateLegal(input, session, desired, occupied, allowOutsideCriteria)
    ) {
      const placement = { ...desired, reason: normalizedReason(desired.reason) };
      placements.set(session.id, placement);
      occupied.push(scheduledSession(session, placement));
    } else {
      deferred.push(session);
    }
  }

  for (const session of interleaveByTrack(deferred)) {
    const placement = findPlacement(input, session, occupied, validationGate);
    if (placement === null) return null;
    placements.set(session.id, placement);
    occupied.push(scheduledSession(session, placement));
  }

  if (
    placements.size !== input.agenda.sessions.length ||
    detectAgendaConflicts(occupied).length > 0
  ) {
    return null;
  }
  return {
    placements: [...placements.values()].sort((left, right) =>
      left.startsAt === right.startsAt
        ? left.roomId.localeCompare(right.roomId)
        : left.startsAt.localeCompare(right.startsAt),
    ),
  };
};

export const solveAgendaDeterministically = (input: AgendaSolverInput) =>
  buildProposal(input, { placements: [] }, false);

export const validateAndRepairAgendaProposal = (
  input: AgendaSolverInput,
  proposal: AgendaDraftProposal,
) => buildProposal(input, proposal, true);
