export interface IcsEventInput {
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly room: string;
  readonly description: string;
  readonly portalUrl: string;
  readonly sequence: number;
  readonly stamp?: Date;
}

const encoder = new TextEncoder();

const escapeText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");

const utc = (date: Date) =>
  date.toISOString().replaceAll("-", "").replaceAll(":", "").slice(0, 15) + "Z";

export const foldIcsLine = (line: string) => {
  const output: Array<string> = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).byteLength > limit) {
      output.push(current);
      current = ` ${character}`;
      limit = 75;
    } else {
      current += character;
    }
  }
  output.push(current);
  return output.join("\r\n");
};

export const buildCalendarInvite = (input: IcsEventInput) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//opensesh.io//Program Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    `X-WR-TIMEZONE:${escapeText(input.timezone)}`,
    "BEGIN:VEVENT",
    `UID:sess-${input.id}@opensesh.io`,
    `DTSTAMP:${utc(input.stamp ?? new Date())}`,
    `DTSTART:${utc(input.startsAt)}`,
    `DTEND:${utc(input.endsAt)}`,
    `SEQUENCE:${input.sequence}`,
    `SUMMARY:${escapeText(input.title)}`,
    `LOCATION:${escapeText(input.room)}`,
    `DESCRIPTION:${escapeText(`${input.description}\n${input.portalUrl}`)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
};

export const buildPersonalScheduleCalendar = (input: {
  readonly name: string;
  readonly timezone: string;
  readonly events: ReadonlyArray<IcsEventInput>;
  readonly stamp?: Date;
}) => {
  const stamp = input.stamp ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//opensesh.io//Personal Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.name)}`,
    `X-WR-TIMEZONE:${escapeText(input.timezone)}`,
    ...input.events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:sess-${event.id}@opensesh.io`,
      `DTSTAMP:${utc(event.stamp ?? stamp)}`,
      `DTSTART:${utc(event.startsAt)}`,
      `DTEND:${utc(event.endsAt)}`,
      `SEQUENCE:${event.sequence}`,
      `SUMMARY:${escapeText(event.title)}`,
      `LOCATION:${escapeText(event.room)}`,
      `DESCRIPTION:${escapeText(`${event.description}\n${event.portalUrl}`)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
};
