import { describe, expect, it } from "vitest";

import { buildCalendarInvite } from "./ics";

const fixed = buildCalendarInvite({
  id: "sub_42",
  title: "Agents, tools; and reliable orchestration — 日本語",
  startsAt: new Date("2027-09-14T13:30:00.000Z"),
  endsAt: new Date("2027-09-14T14:15:00.000Z"),
  timezone: "America/New_York",
  room: "Hall A, Level 2",
  description: `A practical path with \\ and commas, semicolons; plus a deliberately long description ${"reliable ".repeat(12)}`,
  portalUrl: "https://opensesh.io/portal/sessions/sub_42",
  sequence: 3,
  stamp: new Date("2027-08-01T12:00:00.000Z"),
});
const unfolded = fixed.replaceAll("\r\n ", "");

describe("buildCalendarInvite", () => {
  it("builds a deterministic calendar request with UTC dates", () => {
    expect(fixed).toContain("METHOD:REQUEST\r\n");
    expect(fixed).toContain("UID:sess-sub_42@opensesh.io\r\n");
    expect(fixed).toContain("DTSTAMP:20270801T120000Z\r\n");
    expect(fixed).toContain("DTSTART:20270914T133000Z\r\n");
    expect(fixed).toContain("DTEND:20270914T141500Z\r\n");
    expect(fixed).toContain("SEQUENCE:3\r\n");
    expect(fixed).toContain("X-WR-TIMEZONE:America/New_York\r\n");
    expect(fixed.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes text values", () => {
    expect(unfolded).toContain("SUMMARY:Agents\\, tools\\; and reliable orchestration");
    expect(unfolded).toContain("LOCATION:Hall A\\, Level 2");
    expect(unfolded).toContain("with \\\\ and commas\\, semicolons\\;");
    expect(unfolded).toContain("\\nhttps://opensesh.io/portal/sessions/sub_42");
  });

  it("folds every content line at 75 UTF-8 octets without splitting characters", () => {
    const bytes = new TextEncoder();
    for (const line of fixed.split("\r\n")) {
      expect(bytes.encode(line).byteLength).toBeLessThanOrEqual(75);
    }
    expect(fixed).toContain("\r\n ");
    expect(fixed).toContain("日本語");
  });
});
