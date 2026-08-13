import { describe, expect, it } from "vitest";

import {
  audienceMemberIds,
  buildCampaignRecipientRows,
  reminderAlreadyRanInWindow,
  reminderAssignmentsWithinWindow,
} from "./communications";
import { dedupeSpeakerCsvRows, type SpeakerCsvRow } from "./widgets";

const csvRow = (email: string, action: SpeakerCsvRow["action"]): SpeakerCsvRow => ({
  firstName: email.split("@")[0] ?? "Speaker",
  lastName: "Test",
  email,
  title: null,
  company: null,
  bio: null,
  dietary: "none",
  tshirt: null,
  linkedin: null,
  twitter: null,
  facebook: null,
  website: null,
  phone: null,
  action,
});

describe("speaker CSV import planning", () => {
  it("deduplicates normalized emails while retaining Dana and the chosen match actions", () => {
    const planned = dedupeSpeakerCsvRows([
      csvRow("PRIYA@EXAMPLE.COM", "update"),
      csvRow("priya@example.com", "skip"),
      csvRow("marcus@example.com", "update"),
      csvRow("dana@example.com", "create"),
    ]);
    expect(planned).toHaveLength(3);
    expect(planned.map((row) => [row.email.toLowerCase(), row.action])).toEqual([
      ["priya@example.com", "skip"],
      ["marcus@example.com", "update"],
      ["dana@example.com", "create"],
    ]);
  });
});

describe("campaign recipient snapshots", () => {
  it("resolves merge tokens separately and returns one row per selected contact", () => {
    const rows = buildCampaignRecipientRows({
      campaignId: "campaign",
      subject: "Welcome {speaker_name} to {event_name}",
      body: "{talk_title} · {portal_url}",
      eventName: "DevFlow Conf 2027",
      portalUrl: "https://example.com/portal",
      recipients: [
        {
          contactId: "priya",
          speakerName: "Priya Raman",
          talkTitle: "Taming 40-Minute CI",
          email: "priya@example.com",
        },
        {
          contactId: "marcus",
          speakerName: "Marcus Okafor",
          talkTitle: "Agents in Production",
          email: "marcus@example.com",
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.resolvedSubject).toContain("Priya Raman");
    expect(rows[0]?.resolvedBody).toContain("Taming 40-Minute CI");
    expect(rows[1]?.resolvedSubject).toContain("Marcus Okafor");
    expect(rows[1]?.resolvedBody).toContain("Agents in Production");
  });
});

describe("communication audience segments", () => {
  const speaker = (
    id: string,
    confirmedAt: Date | null,
    decisionInformed: boolean,
    taskIncomplete: number,
  ) => ({
    id,
    email: `${id}@example.com`,
    firstName: id,
    lastName: "Speaker",
    headshotUrl: null,
    title: null,
    company: null,
    pipeline: "added" as const,
    confirmedAt,
    decisionInformed,
    taskTotal: taskIncomplete,
    taskDone: 0,
    taskIncomplete,
    talkTitle: "Talk",
  });
  const submitter = (
    id: string,
    status: "pending" | "maybe" | "declined",
    notifiedAt: Date | null,
  ) => ({
    id,
    email: `${id}@example.com`,
    firstName: id,
    lastName: "Submitter",
    headshotUrl: null,
    submissions: [{ status, notifiedAt }],
  });
  const center = {
    speakers: [
      speaker("confirmed", new Date("2027-04-01T00:00:00.000Z"), true, 0),
      speaker("awaiting", null, true, 0),
      speaker("incomplete", new Date("2027-04-01T00:00:00.000Z"), true, 2),
    ],
    submitters: [
      submitter("pending", "pending", null),
      submitter("maybe", "maybe", null),
      submitter("declined", "declined", new Date("2027-04-01T00:00:00.000Z")),
      submitter("uninformed-decline", "declined", null),
      // Submitterhood is a submission fact: current speakers stay in the pool
      // when they also submitted ("awaiting" has a second talk pending,
      // "confirmed" had another submission declined and informed).
      submitter("awaiting", "pending", null),
      submitter("confirmed", "declined", new Date("2027-04-01T00:00:00.000Z")),
    ],
  };

  it("returns exact live membership for every derived segment", () => {
    expect(audienceMemberIds(center, "all_speakers")).toEqual([
      "confirmed",
      "awaiting",
      "incomplete",
    ]);
    expect(audienceMemberIds(center, "confirmed")).toEqual(["confirmed", "incomplete"]);
    expect(audienceMemberIds(center, "awaiting_confirmation")).toEqual(["awaiting"]);
    expect(audienceMemberIds(center, "incomplete_tasks")).toEqual(["incomplete"]);
    expect(audienceMemberIds(center, "all_submitters")).toEqual([
      "pending",
      "maybe",
      "declined",
      "uninformed-decline",
      "awaiting",
      "confirmed",
    ]);
    // A pending submission keeps you in awaiting_decision even while you
    // speak; declined consolation never reaches a current speaker.
    expect(audienceMemberIds(center, "awaiting_decision")).toEqual([
      "pending",
      "maybe",
      "awaiting",
    ]);
    expect(audienceMemberIds(center, "declined")).toEqual(["declined"]);
    // Each hand-picked segment resolves against its own pool: "maybe" is not
    // a speaker, and a speaker who submitted is selectable as a submitter.
    expect(audienceMemberIds(center, "selected", new Set(["maybe", "awaiting"]))).toEqual([
      "awaiting",
    ]);
    expect(
      audienceMemberIds(center, "selected_submitters", new Set(["maybe", "awaiting"])),
    ).toEqual(["maybe", "awaiting"]);
  });
});

describe("reminder delivery window", () => {
  const now = new Date("2027-04-10T12:00:00.000Z");

  it("includes only incomplete, unwaived assignments due inside the window", () => {
    const eligible = reminderAssignmentsWithinWindow(
      [
        {
          assignmentId: "todo",
          contactId: "priya",
          status: "todo",
          dueDate: new Date("2027-04-12T00:00:00.000Z"),
          taskTitle: "Release",
        },
        {
          assignmentId: "done",
          contactId: "priya",
          status: "done",
          dueDate: new Date("2027-04-12T00:00:00.000Z"),
          taskTitle: "Bio",
        },
        {
          assignmentId: "waived",
          contactId: "marcus",
          status: "waived",
          dueDate: new Date("2027-04-11T00:00:00.000Z"),
          taskTitle: "Headshot",
        },
        {
          assignmentId: "late",
          contactId: "marcus",
          status: "todo",
          dueDate: new Date("2027-04-20T00:00:00.000Z"),
          taskTitle: "Slides",
        },
      ],
      now,
      3,
    );
    expect(eligible.map((assignment) => assignment.assignmentId)).toEqual(["todo"]);
  });

  it("is idempotent after a run in the same UTC delivery day", () => {
    expect(reminderAlreadyRanInWindow(new Date("2027-04-10T08:00:00.000Z"), now)).toBe(true);
    expect(reminderAlreadyRanInWindow(new Date("2027-04-09T23:59:59.000Z"), now)).toBe(false);
    expect(reminderAlreadyRanInWindow(null, now)).toBe(false);
  });
});
