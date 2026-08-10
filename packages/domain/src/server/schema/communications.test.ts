import { describe, expect, it } from "vitest";

import {
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
