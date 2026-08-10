import { and, asc, count, eq, gt, isNotNull, lt } from "drizzle-orm";
import { alias, type PgTable } from "drizzle-orm/pg-core";

import {
  accounts,
  agendaDrafts,
  contacts,
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
  organizations,
  portalFormResponses,
  portalForms,
  reviewerTracks,
  reviews,
  rooms,
  sessionFileRequirements,
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
  { name: "organization_members", table: organizationMembers, expected: 5 },
  { name: "events", table: events, expected: 1 },
  { name: "agenda_drafts", table: agendaDrafts, expected: 0 },
  { name: "users", table: users, expected: 5 },
  { name: "accounts", table: accounts, expected: 5 },
  { name: "event_members", table: eventMembers, expected: 2 },
  { name: "reviewer_tracks", table: reviewerTracks, expected: 2 },
  { name: "tracks", table: tracks, expected: 4 },
  { name: "tags", table: tags, expected: 8 },
  { name: "formats", table: formats, expected: 5 },
  { name: "levels", table: levels, expected: 3 },
  { name: "rooms", table: rooms, expected: 4 },
  { name: "forms", table: forms, expected: 1 },
  { name: "form_fields", table: formFields, expected: 11 },
  { name: "contacts", table: contacts, expected: 26 },
  { name: "submissions", table: submissions, expected: 32 },
  { name: "submission_tracks", table: submissionTracks, expected: 32 },
  { name: "submission_tags", table: submissionTags, expected: 64 },
  { name: "submission_participants", table: submissionParticipants, expected: 38 },
  { name: "reviews", table: reviews, expected: 6 },
  { name: "portal_forms", table: portalForms, expected: 2 },
  { name: "portal_form_responses", table: portalFormResponses, expected: 4 },
  { name: "file_requests", table: fileRequests, expected: 1 },
  { name: "session_file_requirements", table: sessionFileRequirements, expected: 2 },
  { name: "file_uploads", table: fileUploads, expected: 1 },
  { name: "file_versions", table: fileVersions, expected: 1 },
  { name: "file_comments", table: fileComments, expected: 2 },
  { name: "submission_edit_history", table: submissionEditHistory, expected: 0 },
  { name: "task_templates", table: taskTemplates, expected: 4 },
  { name: "task_assignments", table: taskAssignments, expected: 54 },
  { name: "email_log", table: emailLog, expected: 4 },
];

const expectedStatuses = {
  accepted: 12,
  declined: 2,
  draft: 2,
  maybe: 4,
  pending: 11,
  withdrawn: 1,
} as const;

export const verifySeed = async (database: Database) => {
  const otherSubmission = alias(submissions, "other_submission");
  const [summary, statusRows, conflicts, memberships] = await Promise.all([
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
  ]);
  console.table(summary);

  const statusMatches = statusRows.every(({ status, total }) => expectedStatuses[status] === total);
  const membershipsMatch =
    memberships.length === 5 &&
    memberships.every((membership) => membership.organization === "ai-engineer");

  if (
    summary.some((entry) => entry.status !== "ok") ||
    statusRows.length !== Object.keys(expectedStatuses).length ||
    !statusMatches ||
    conflicts.length !== 1 ||
    !membershipsMatch
  ) {
    process.stderr.write("Seed verification failed.\n");
    process.exitCode = 1;
    return false;
  }

  process.stdout.write(
    "Seed verification passed: status mix, one conflict, and org memberships.\n",
  );
  return true;
};
