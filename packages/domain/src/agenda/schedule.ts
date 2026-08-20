import type { ScheduleChange } from "../server/schema/agenda";

export interface AgendaScheduleContext {
  readonly timezone: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly roomIds: ReadonlyArray<string>;
}

const zonedParts = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
    second: part("second"),
  };
};

const dateKey = (value: string, timezone: string) => {
  const parts = zonedParts(value, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

// Shared time rules for anything placed on the agenda grid — sessions and
// blocks alike. `noun` only changes the error copy.
const validateGridWindow = (
  startsAt: string,
  endsAt: string,
  context: AgendaScheduleContext,
  noun: string,
): string | null => {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "End time must be after start time";
  }
  // Starts and durations align to 5 minutes — a 10-minute lightning talk must
  // schedule as exactly 10 minutes. The visible grid increment (5/10/15/30)
  // is a view preference; the 5-minute mark is the data-model floor.
  if ((end - start) % (5 * 60_000) !== 0) return "Duration must use 5-minute increments";

  const startParts = zonedParts(startsAt, context.timezone);
  const endParts = zonedParts(endsAt, context.timezone);
  const startDay = dateKey(startsAt, context.timezone);
  const endDay = dateKey(endsAt, context.timezone);
  const firstDay = dateKey(context.startsAt, context.timezone);
  const lastDay = dateKey(context.endsAt, context.timezone);
  if (startDay !== endDay || startDay < firstDay || startDay > lastDay) {
    return `Keep the ${noun} within one event day`;
  }
  if (
    startParts.second !== 0 ||
    endParts.second !== 0 ||
    startParts.minute % 5 !== 0 ||
    endParts.minute % 5 !== 0
  ) {
    return "Start on a 5-minute mark";
  }
  return null;
};

export const validateScheduleChange = (
  change: Pick<ScheduleChange, "roomId" | "startsAt" | "endsAt">,
  context: AgendaScheduleContext,
): string | null => {
  const empty = change.roomId === null && change.startsAt === null && change.endsAt === null;
  if (empty) return null;
  if (change.roomId === null || change.startsAt === null || change.endsAt === null) {
    return "Choose a room, start time, and end time";
  }
  if (!context.roomIds.includes(change.roomId)) return "Choose a room from this event";
  return validateGridWindow(change.startsAt, change.endsAt, context, "session");
};

export const validateBlockPlacement = (
  block: { readonly roomId: string | null; readonly startsAt: string; readonly endsAt: string },
  context: AgendaScheduleContext,
): string | null => {
  if (block.roomId !== null && !context.roomIds.includes(block.roomId)) {
    return "Choose a room from this event";
  }
  return validateGridWindow(block.startsAt, block.endsAt, context, "block");
};
