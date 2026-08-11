import { and, asc, count, eq, gt, inArray, isNotNull, lt } from "drizzle-orm";
import { alias, type PgTable } from "drizzle-orm/pg-core";

import {
  accounts,
  aiReviewResults,
  agendaDrafts,
  contacts,
  contactEditHistory,
  crmPipelineCards,
  crmPipelineStages,
  crmSegments,
  crmStageHistory,
  emailCampaignRecipients,
  emailCampaigns,
  emailTemplates,
  emailLog,
  eventMembers,
  events,
  fileRequests,
  fileComments,
  fileUploads,
  fileVersions,
  formFields,
  formats,
  forms,
  levels,
  organizationMembers,
  organizationContactEvents,
  organizationContactNotes,
  organizationContactTags,
  organizationContacts,
  organizationTags,
  organizations,
  portalFormResponses,
  portalForms,
  reviewerTracks,
  reminderRules,
  reviewAnswers,
  reviewAssignments,
  reviewCriteria,
  reviewRoundMembers,
  reviewRounds,
  reviews,
  rooms,
  sessionFileRequirements,
  sessionFileRequirementAssignments,
  submissionParticipants,
  submissionEditHistory,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  taskAssignments,
  taskTemplates,
  tracks,
  users,
} from "../db/schema";
import type { Database } from "../server/db";

const expectedTables: ReadonlyArray<{
  readonly name: string;
  readonly table: PgTable;
  readonly expected: number;
}> = [
  { name: "organizations", table: organizations, expected: 1 },
  { name: "organization_members", table: organizationMembers, expected: 4 },
  { name: "events", table: events, expected: 2 },
  { name: "agenda_drafts", table: agendaDrafts, expected: 0 },
  { name: "users", table: users, expected: 9 },
  { name: "accounts", table: accounts, expected: 9 },
  { name: "event_members", table: eventMembers, expected: 3 },
  { name: "reviewer_tracks", table: reviewerTracks, expected: 2 },
  { name: "tracks", table: tracks, expected: 7 },
  { name: "tags", table: tags, expected: 8 },
  { name: "formats", table: formats, expected: 10 },
  { name: "levels", table: levels, expected: 6 },
  { name: "rooms", table: rooms, expected: 8 },
  { name: "forms", table: forms, expected: 2 },
  { name: "form_fields", table: formFields, expected: 20 },
  { name: "contacts", table: contacts, expected: 28 },
  { name: "submissions", table: submissions, expected: 36 },
  { name: "submission_tracks", table: submissionTracks, expected: 36 },
  { name: "submission_tags", table: submissionTags, expected: 64 },
  { name: "submission_participants", table: submissionParticipants, expected: 44 },
  { name: "reviews", table: reviews, expected: 6 },
  { name: "portal_forms", table: portalForms, expected: 2 },
  { name: "portal_form_responses", table: portalFormResponses, expected: 4 },
  { name: "file_requests", table: fileRequests, expected: 1 },
  { name: "session_file_requirements", table: sessionFileRequirements, expected: 2 },
  {
    name: "session_file_requirement_assignments",
    table: sessionFileRequirementAssignments,
    expected: 28,
  },
  { name: "file_uploads", table: fileUploads, expected: 1 },
  { name: "file_versions", table: fileVersions, expected: 1 },
  { name: "file_comments", table: fileComments, expected: 2 },
  { name: "submission_edit_history", table: submissionEditHistory, expected: 0 },
  { name: "contact_edit_history", table: contactEditHistory, expected: 1 },
  { name: "task_templates", table: taskTemplates, expected: 4 },
  { name: "task_assignments", table: taskAssignments, expected: 54 },
  { name: "email_log", table: emailLog, expected: 4 },
  { name: "review_rounds", table: reviewRounds, expected: 2 },
  { name: "review_criteria", table: reviewCriteria, expected: 6 },
  { name: "review_round_members", table: reviewRoundMembers, expected: 1 },
  { name: "review_assignments", table: reviewAssignments, expected: 0 },
  { name: "review_answers", table: reviewAnswers, expected: 0 },
  { name: "ai_review_results", table: aiReviewResults, expected: 0 },
  { name: "email_templates", table: emailTemplates, expected: 1 },
  { name: "email_campaigns", table: emailCampaigns, expected: 0 },
  { name: "email_campaign_recipients", table: emailCampaignRecipients, expected: 0 },
  { name: "reminder_rules", table: reminderRules, expected: 1 },
  { name: "organization_contacts", table: organizationContacts, expected: 28 },
  { name: "organization_contact_events", table: organizationContactEvents, expected: 28 },
  { name: "organization_contact_notes", table: organizationContactNotes, expected: 0 },
  { name: "organization_tags", table: organizationTags, expected: 3 },
  { name: "organization_contact_tags", table: organizationContactTags, expected: 6 },
  { name: "crm_pipeline_stages", table: crmPipelineStages, expected: 4 },
  { name: "crm_pipeline_cards", table: crmPipelineCards, expected: 5 },
  { name: "crm_stage_history", table: crmStageHistory, expected: 9 },
  { name: "crm_segments", table: crmSegments, expected: 1 },
];

const expectedStatuses = {
  accepted: 12,
  declined: 2,
  draft: 2,
  maybe: 4,
  pending: 15,
  withdrawn: 1,
} as const;

export const verifySeed = async (database: Database) => {
  const otherSubmission = alias(submissions, "other_submission");
  const [
    summary,
    statusRows,
    conflicts,
    memberships,
    personas,
    devflow,
    devflowLibrary,
    rounds,
    deliverables,
  ] = await Promise.all([
    Promise.all(
      expectedTables.map(async (entry) => {
        const actual = await database.$count(entry.table);
        return {
          table: entry.name,
          expected: entry.expected,
          actual,
          status: actual === entry.expected ? "ok" : "mismatch",
        };
      }),
    ),
    database
      .select({ status: submissions.status, total: count() })
      .from(submissions)
      .groupBy(submissions.status)
      .orderBy(asc(submissions.status)),
    database
      .select({ id: submissions.id, otherId: otherSubmission.id })
      .from(submissions)
      .innerJoin(
        otherSubmission,
        and(
          lt(submissions.id, otherSubmission.id),
          eq(submissions.roomId, otherSubmission.roomId),
          lt(submissions.startsAt, otherSubmission.endsAt),
          gt(submissions.endsAt, otherSubmission.startsAt),
        ),
      )
      .where(isNotNull(submissions.roomId)),
    database
      .select({
        email: users.email,
        organization: organizations.slug,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .orderBy(asc(users.email)),
    database
      .select({ email: users.email, providerId: accounts.providerId })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(
        inArray(users.email, [
          "jordan.organizer@sbek-test.example.com",
          "priya.speaker@sbek-test.example.com",
          "marcus.speaker@sbek-test.example.com",
          "sam.reviewer@sbek-test.example.com",
        ]),
      )
      .orderBy(asc(users.email)),
    database.select().from(events).where(eq(events.slug, "devflow-conf-2027")).limit(1),
    Promise.all([
      database.$count(tracks, eq(tracks.eventId, "evt_devflow_2027")),
      database.$count(formats, eq(formats.eventId, "evt_devflow_2027")),
      database.$count(rooms, eq(rooms.eventId, "evt_devflow_2027")),
      database.$count(submissions, eq(submissions.eventId, "evt_devflow_2027")),
    ]),
    database
      .select({ round: reviewRounds, criterion: reviewCriteria })
      .from(reviewRounds)
      .leftJoin(reviewCriteria, eq(reviewCriteria.roundId, reviewRounds.id))
      .where(eq(reviewRounds.eventId, "evt_devflow_2027"))
      .orderBy(asc(reviewRounds.position), asc(reviewCriteria.position)),
    database
      .select({
        requirementId: sessionFileRequirementAssignments.requirementId,
        contactId: sessionFileRequirementAssignments.contactId,
        status: sessionFileRequirementAssignments.status,
      })
      .from(sessionFileRequirementAssignments)
      .where(eq(sessionFileRequirementAssignments.submissionId, "sub_21")),
  ]);
  console.table(summary);

  const statusMatches = statusRows.every(({ status, total }) => expectedStatuses[status] === total);
  const expectedMemberships = new Map([
    ["demo@opensesh.io", "owner"],
    ["jordan.organizer@sbek-test.example.com", "member"],
    ["reviewer@opensesh.io", "member"],
    ["sam.reviewer@sbek-test.example.com", "member"],
  ]);
  const membershipsMatch =
    memberships.length === expectedMemberships.size &&
    memberships.every(
      (membership) =>
        membership.organization === "ai-engineer" &&
        expectedMemberships.get(membership.email) === membership.role,
    );
  const devflowEvent = devflow[0];
  const personasMatch =
    personas.length === 4 && personas.every((persona) => persona.providerId === "credential");
  const devflowMatches =
    devflowEvent?.name === "DevFlow Conf 2027" &&
    devflowEvent.tagline === "The developer workflow conference" &&
    devflowEvent.location === "Moscone West, San Francisco, CA" &&
    devflowEvent.timezone === "America/Los_Angeles" &&
    devflowLibrary.join(",") === "3,5,4,4";
  const roundsMatch =
    new Set(rounds.map((row) => row.round.id)).size === 2 &&
    rounds.filter((row) => row.round.id === "rnd_devflow_initial").length === 4 &&
    rounds.filter((row) => row.round.id === "rnd_devflow_final").length === 2;
  const deliverablesMatch =
    deliverables.length === 3 &&
    deliverables.some(
      (row) =>
        row.requirementId === "sfr_slides" &&
        row.contactId === "con_01" &&
        row.status === "uploaded",
    ) &&
    deliverables.some(
      (row) =>
        row.requirementId === "sfr_slides" &&
        row.contactId === "con_13" &&
        row.status === "outstanding",
    ) &&
    deliverables.some(
      (row) =>
        row.requirementId === "sfr_intro" && row.contactId === null && row.status === "outstanding",
    );

  if (
    summary.some((entry) => entry.status !== "ok") ||
    statusRows.length !== Object.keys(expectedStatuses).length ||
    !statusMatches ||
    conflicts.length !== 1 ||
    !membershipsMatch ||
    !personasMatch ||
    !devflowMatches ||
    !roundsMatch ||
    !deliverablesMatch
  ) {
    process.stderr.write("Seed verification failed.\n");
    process.exitCode = 1;
    return false;
  }

  process.stdout.write(
    "Seed verification passed: DevFlow fixtures, personas, review rounds, CRM, status mix, one conflict, and org memberships.\n",
  );
  return true;
};
