import { describe, expect, it } from "vitest";

import type { AgendaSession } from "../server/schema/agenda";
import { detectAgendaConflicts } from "./conflicts";

const session = (
  id: string,
  roomId: string | null,
  startsAt: string | null,
  endsAt: string | null,
  speakers: ReadonlyArray<{ readonly id: string; readonly name: string }> = [],
): AgendaSession => ({
  id,
  code: `SESS-${id}`,
  title: `Session ${id}`,
  description: "",
  startsAt,
  endsAt,
  roomId,
  scheduleDirty: false,
  durationMinutes: 60,
  formatName: "Talk",
  tracks: [],
  speakers,
});

describe("detectAgendaConflicts", () => {
  it("finds the planted-style same-room overlap", () => {
    const conflicts = detectAgendaConflicts([
      session("17", "hall-a", "2026-10-12T14:00:00.000Z", "2026-10-12T15:00:00.000Z"),
      session("18", "hall-a", "2026-10-12T14:30:00.000Z", "2026-10-12T15:30:00.000Z"),
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        id: "room:17:18",
        kind: "room",
        roomId: "hall-a",
        sessionIds: ["17", "18"],
      }),
    ]);
  });

  it("finds a shared speaker overlap across different rooms", () => {
    const maya = { id: "maya", name: "Maya Chen" };
    const conflicts = detectAgendaConflicts([
      session("a", "hall-a", "2026-10-12T16:00:00.000Z", "2026-10-12T17:00:00.000Z", [maya]),
      session("b", "hall-b", "2026-10-12T16:30:00.000Z", "2026-10-12T17:30:00.000Z", [maya]),
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        id: "speaker:maya:a:b",
        kind: "speaker",
        roomId: null,
        speaker: maya,
      }),
    ]);
  });

  it("allows adjacent sessions and ignores unscheduled sessions", () => {
    const conflicts = detectAgendaConflicts([
      session("a", "hall-a", "2026-10-12T16:00:00.000Z", "2026-10-12T17:00:00.000Z"),
      session("b", "hall-a", "2026-10-12T17:00:00.000Z", "2026-10-12T18:00:00.000Z"),
      session("c", null, null, null),
    ]);

    expect(conflicts).toEqual([]);
  });

  it("reports both room and speaker reasons for the same pair", () => {
    const speaker = { id: "shared", name: "Shared Speaker" };
    const conflicts = detectAgendaConflicts([
      session("a", "hall-a", "2026-10-12T16:00:00.000Z", "2026-10-12T17:00:00.000Z", [speaker]),
      session("b", "hall-a", "2026-10-12T16:15:00.000Z", "2026-10-12T16:45:00.000Z", [speaker]),
    ]);

    expect(conflicts.map((conflict) => conflict.kind)).toEqual(["room", "speaker"]);
  });
});
