import { describe, expect, it } from "vitest";

import type { PublicProgram, WidgetView } from "./server/schema/widgets";
import {
  filterPublicSessions,
  restorePersonalSchedule,
  serializePersonalSchedule,
  serializePublicView,
} from "./public-program";

const program: PublicProgram = {
  event: {
    id: "event-1",
    slug: "devflow",
    name: "DevFlow Conf",
    tagline: null,
    description: null,
    logoUrl: null,
    location: "San Francisco",
    timezone: "America/Los_Angeles",
    startsAt: "2027-05-12T07:00:00.000Z",
    endsAt: "2027-05-15T06:59:59.000Z",
    agendaPublishedAt: "2027-04-01T12:00:00.000Z",
  },
  tracks: [
    { id: "ai", name: "AI Engineering", color: "#336633" },
    { id: "platform", name: "Platform & Infra", color: "#663333" },
  ],
  formats: [
    { id: "talk", name: "Talk" },
    { id: "workshop", name: "Workshop" },
  ],
  tags: [],
  sessions: [
    {
      id: "session-1",
      code: "SESS-1",
      title: "Verification Patterns That Scale",
      description: "Reliable agent systems.",
      format: { id: "talk", name: "Talk" },
      level: null,
      tracks: [{ id: "ai", name: "AI Engineering", color: "#336633" }],
      tags: [],
      speakers: [
        {
          id: "priya",
          firstName: "Priya",
          lastName: "Raman",
          title: "Principal Engineer",
          company: "Latticework Systems",
          bio: null,
          headshotUrl: null,
        },
      ],
      startsAt: "2027-05-12T16:00:00.000Z",
      endsAt: "2027-05-12T16:30:00.000Z",
      roomName: "Main Stage",
    },
    {
      id: "session-2",
      code: "SESS-2",
      title: "Incremental Builds at Scale",
      description: "Fast monorepos.",
      format: { id: "workshop", name: "Workshop" },
      level: null,
      tracks: [{ id: "platform", name: "Platform & Infra", color: "#663333" }],
      tags: [],
      speakers: [
        {
          id: "marcus",
          firstName: "Marcus",
          lastName: "Okafor",
          title: "Staff Developer Advocate",
          company: "Cloudreach Labs",
          bio: null,
          headshotUrl: null,
        },
      ],
      startsAt: "2027-05-13T18:00:00.000Z",
      endsAt: "2027-05-13T20:00:00.000Z",
      roomName: "Workshop Lab",
    },
  ],
};

describe("public program utilities", () => {
  it("matches titles and speaker names case-insensitively", () => {
    expect(
      filterPublicSessions(program.sessions, {
        search: "vErIfIcAtIoN",
        timezone: program.event.timezone,
      }).map((session) => session.id),
    ).toEqual(["session-1"]);
    expect(
      filterPublicSessions(program.sessions, {
        search: "oKaFoR",
        timezone: program.event.timezone,
      }).map((session) => session.id),
    ).toEqual(["session-2"]);
  });

  it("combines track, format, room, and day filters with intersection semantics", () => {
    expect(
      filterPublicSessions(program.sessions, {
        timezone: program.event.timezone,
        trackIds: ["ai"],
        formatIds: ["talk"],
        roomNames: ["Main Stage"],
        dayKeys: ["2027-05-12"],
      }).map((session) => session.id),
    ).toEqual(["session-1"]);
    expect(
      filterPublicSessions(program.sessions, {
        timezone: program.event.timezone,
        trackIds: ["ai"],
        formatIds: ["workshop"],
      }),
    ).toEqual([]);
  });

  it("round-trips the exact selected identifiers and ignores invalid storage", () => {
    const serialized = serializePersonalSchedule(["session-2", "session-1"]);
    expect(restorePersonalSchedule(serialized)).toEqual(["session-2", "session-1"]);
    expect(restorePersonalSchedule("not-json")).toEqual([]);
  });

  it("returns identical source metadata through all five view serializers", () => {
    const views: ReadonlyArray<WidgetView> = [
      "sessions",
      "speakers",
      "speaker_gallery",
      "agenda",
      "itinerary",
    ];
    const serialized = views.map((view) => serializePublicView(program, view));
    for (const value of serialized.slice(1)) expect(value).toEqual(serialized[0]);
  });
});
