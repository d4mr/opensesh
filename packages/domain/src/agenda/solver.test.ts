import { describe, expect, it } from "vitest";

import { seedData } from "../seed/data";
import type { AgendaAdminData, AgendaDraftProposal } from "../server/schema/agenda";
import { detectAgendaConflicts } from "./conflicts";
import { solveAgendaDeterministically, validateAndRepairAgendaProposal } from "./solver";

const event = seedData.events[0];
if (event === undefined) {
  process.stderr.write("Seed event is required for agenda solver tests.\n");
  process.exit(1);
}

const agenda: AgendaAdminData = {
  event: {
    id: event.id,
    slug: event.slug,
    name: event.name,
    timezone: event.timezone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    agendaPublishedAt: null,
    agendaDirty: false,
  },
  aiConfigured: false,
  rooms: seedData.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    position: room.position,
  })),
  tracks: seedData.tracks.map((track) => ({
    id: track.id,
    name: track.name,
    color: track.color,
  })),
  sessions: seedData.submissions
    .filter((submission) => submission.status === "accepted")
    .map((submission) => {
      const format = seedData.formats.find((item) => item.id === submission.formatId);
      return {
        id: submission.id,
        code: submission.code,
        title: submission.title,
        description: submission.description,
        startsAt: submission.startsAt?.toISOString() ?? null,
        endsAt: submission.endsAt?.toISOString() ?? null,
        roomId: submission.roomId,
        scheduleDirty: false,
        durationMinutes: 30,
        formatName: format?.name ?? null,
        tracks: seedData.submissionTracks
          .filter((link) => link.submissionId === submission.id)
          .flatMap((link) => {
            const track = seedData.tracks.find((item) => item.id === link.trackId);
            return track === undefined
              ? []
              : [{ id: track.id, name: track.name, color: track.color }];
          }),
        speakers: seedData.submissionParticipants
          .filter((participant) => participant.submissionId === submission.id)
          .flatMap((participant) => {
            const contact = seedData.contacts.find((item) => item.id === participant.contactId);
            return contact === undefined
              ? []
              : [
                  {
                    id: contact.id,
                    name: `${contact.firstName} ${contact.lastName}`,
                  },
                ];
          }),
      };
    }),
};

const criteria = {
  days: ["2026-10-12", "2026-10-13", "2026-10-14"],
  roomIds: agenda.rooms.map((room) => room.id),
  includeStatuses: ["accepted"],
  respectExistingPlacements: false,
  rules: ["keynotes in Hall A morning", "spread each track across days"],
} as const;

const proposalSessions = (proposal: AgendaDraftProposal) =>
  agenda.sessions.map((session) => {
    const placement = proposal.placements.find((item) => item.submissionId === session.id);
    return placement === undefined
      ? session
      : {
          ...session,
          roomId: placement.roomId,
          startsAt: placement.startsAt,
          endsAt: placement.endsAt,
        };
  });

describe("deterministic agenda solver", () => {
  it("replaces the seeded Hall A overlap with a complete conflict-free proposal", () => {
    expect(detectAgendaConflicts(agenda.sessions)).toHaveLength(1);

    const proposal = solveAgendaDeterministically({ agenda, criteria });

    expect(proposal).not.toBeNull();
    if (proposal === null) return;
    expect(proposal.placements).toHaveLength(agenda.sessions.length);
    expect(detectAgendaConflicts(proposalSessions(proposal))).toEqual([]);

    const keynotes = agenda.sessions.filter((session) =>
      session.formatName?.toLowerCase().includes("keynote"),
    );
    for (const keynote of keynotes) {
      const placement = proposal.placements.find((item) => item.submissionId === keynote.id);
      expect(placement?.roomId).toBe("room_a");
      expect(
        new Intl.DateTimeFormat("en-US", {
          timeZone: agenda.event.timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date(placement?.startsAt ?? "")),
      ).toMatch(/^(08|09|10|11)$/);
    }
  });
});

describe("agenda proposal validation gate", () => {
  it("repairs an adversarial one-room, one-time proposal before it can be stored", () => {
    const startsAt = "2026-10-12T13:00:00.000Z";
    const adversarial: AgendaDraftProposal = {
      placements: agenda.sessions.map((session) => ({
        submissionId: session.id,
        roomId: "room_a",
        startsAt,
        endsAt: new Date(
          Date.parse(startsAt) +
            (session.startsAt === null || session.endsAt === null
              ? session.durationMinutes
              : Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000)) *
              60_000,
        ).toISOString(),
        reason: "Put everything in one room at 9am.",
      })),
    };

    expect(detectAgendaConflicts(proposalSessions(adversarial)).length).toBeGreaterThan(0);
    const repaired = validateAndRepairAgendaProposal({ agenda, criteria }, adversarial);

    expect(repaired).not.toBeNull();
    if (repaired === null) return;
    expect(repaired.placements).toHaveLength(agenda.sessions.length);
    expect(detectAgendaConflicts(proposalSessions(repaired))).toEqual([]);
    expect(
      repaired.placements.filter((placement) =>
        placement.reason.startsWith("Repaired by validation gate"),
      ).length,
    ).toBeGreaterThan(0);
  });
});
