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

const partsKey = (parts: { readonly year: number; readonly month: number; readonly day: number }) =>
  `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

export const dateKeyFor = (value: string, timezone: string) =>
  partsKey(zonedParts(value, timezone));

export const minutesFor = (value: string, timezone: string) => {
  const parts = zonedParts(value, timezone);
  return parts.hour * 60 + parts.minute;
};

export const eventDateKeys = (startsAt: string, endsAt: string, timezone: string) => {
  const first = dateKeyFor(startsAt, timezone);
  const last = dateKeyFor(endsAt, timezone);
  const [year, month, day] = first.split("-").map(Number);
  const cursor = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  const keys: Array<string> = [];
  while (keys.length < 31) {
    const key = cursor.toISOString().slice(0, 10);
    keys.push(key);
    if (key === last) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
};

export const zonedDateTimeIso = (dateKey: string, minutes: number, timezone: string) => {
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

export const formatTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const formatDay = (dateKey: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateKey}T12:00:00.000Z`),
  );

export const formatLongDay = (dateKey: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));

export const timeInputValue = (value: string, timezone: string) => {
  const minutes = minutesFor(value, timezone);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

export const inputMinutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
};
