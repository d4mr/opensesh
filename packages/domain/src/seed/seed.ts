import {
  accounts,
  contacts,
  emailLog,
  eventMembers,
  events,
  fileRequests,
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
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  taskAssignments,
  taskTemplates,
  tracks,
  users,
} from "../db/schema";
import { hashPassword } from "better-auth/crypto";
import { type Database, wipeSeedData } from "../server/db";
import { seedData } from "./data";

const seededAt = new Date(1785585600000);
const DEMO_PASSWORD = "demo-pass-2027";
const rows = <A extends object>(values: ReadonlyArray<A>) => values.map((value) => ({ ...value }));
const trackIdsBySubmission = new Map<string, Array<string>>();
for (const row of seedData.submissionTracks) {
  trackIdsBySubmission.set(row.submissionId, [
    ...(trackIdsBySubmission.get(row.submissionId) ?? []),
    row.trackId,
  ]);
}
const tagIdsBySubmission = new Map<string, Array<string>>();
for (const row of seedData.submissionTags) {
  tagIdsBySubmission.set(row.submissionId, [
    ...(tagIdsBySubmission.get(row.submissionId) ?? []),
    row.tagId,
  ]);
}
// Form-sourced submissions carry per-field answers, exactly as the public
// wizard would have written them — otherwise a speaker's first portal edit
// diffs every field against an empty object.
const answersForSeedSubmission = (submission: (typeof seedData.submissions)[number]) =>
  submission.sourceFormId === "form_sessions"
    ? {
        fld_title: submission.title,
        fld_description: submission.description,
        fld_format: submission.formatId ?? "",
        fld_level: submission.levelId ?? "",
        fld_track: trackIdsBySubmission.get(submission.id)?.[0] ?? "",
        fld_tags: tagIdsBySubmission.get(submission.id) ?? [],
      }
    : submission.answers;
const submissionRows = seedData.submissions.map((submission) => {
  const answers = answersForSeedSubmission(submission);
  return {
    ...submission,
    // Accepted submissions have graduated to sessions (see review-desk accept).
    kind: submission.status === "accepted" ? ("session" as const) : submission.kind,
    scheduleDirty: false,
    answers,
    approvedSnapshot: {
      title: submission.title,
      description: submission.description,
      formatId: submission.formatId,
      levelId: submission.levelId,
      language: submission.language,
      answers,
    },
    contentReviewStatus: "approved" as const,
  };
});

export const seedDatabase = async (database: Database) => {
  const password = await hashPassword(DEMO_PASSWORD);
  await wipeSeedData(database);
  await database.transaction(async (transaction) => {
    await Promise.all([
      transaction.insert(organizations).values({
        id: "org_ai_engineer",
        name: "AI.Engineer",
        slug: "ai-engineer",
        logo: null,
        metadata: null,
        createdAt: seededAt,
      }),
      transaction.insert(users).values(rows(seedData.users)),
    ]);

    await Promise.all([
      transaction.insert(organizationMembers).values([
        {
          id: "org_mem_dana",
          organizationId: "org_ai_engineer",
          userId: "usr_dana",
          role: "owner",
          createdAt: seededAt,
        },
        {
          id: "org_mem_rey",
          organizationId: "org_ai_engineer",
          userId: "usr_rey",
          role: "member",
          createdAt: seededAt,
        },
        {
          id: "org_mem_maya",
          organizationId: "org_ai_engineer",
          userId: "usr_maya",
          role: "member",
          createdAt: seededAt,
        },
        {
          id: "org_mem_lina",
          organizationId: "org_ai_engineer",
          userId: "usr_lina",
          role: "member",
          createdAt: seededAt,
        },
        {
          id: "org_mem_jamal",
          organizationId: "org_ai_engineer",
          userId: "usr_jamal",
          role: "member",
          createdAt: seededAt,
        },
      ]),
      transaction.insert(accounts).values(
        seedData.users.map((user) => ({
          id: `acc_${user.id}`,
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ),
      transaction.insert(events).values(rows(seedData.events)),
    ]);

    await Promise.all([
      transaction.insert(eventMembers).values(rows(seedData.eventMembers)),
      transaction.insert(tracks).values(rows(seedData.tracks)),
      transaction.insert(tags).values(rows(seedData.tags)),
      transaction.insert(formats).values(rows(seedData.formats)),
      transaction.insert(levels).values(rows(seedData.levels)),
      transaction.insert(rooms).values(rows(seedData.rooms)),
      transaction.insert(forms).values(rows(seedData.forms)),
      transaction.insert(contacts).values(
        seedData.contacts.map((contact) => ({
          ...contact,
          confirmedAt: seedData.submissions.some(
            (submission) =>
              submission.status === "accepted" &&
              seedData.submissionParticipants.some(
                (participant) =>
                  participant.submissionId === submission.id &&
                  participant.contactId === contact.id,
              ),
          )
            ? new Date(1788264000000)
            : null,
        })),
      ),
      transaction.insert(portalForms).values(rows(seedData.portalForms)),
      transaction.insert(fileRequests).values(rows(seedData.fileRequests)),
    ]);

    await Promise.all([
      transaction.insert(reviewerTracks).values(rows(seedData.reviewerTracks)),
      transaction.insert(formFields).values(rows(seedData.formFields)),
      transaction.insert(submissions).values(submissionRows),
      transaction.insert(taskTemplates).values(rows(seedData.taskTemplates)),
    ]);

    await Promise.all([
      transaction.insert(submissionTracks).values(rows(seedData.submissionTracks)),
      transaction.insert(submissionTags).values(rows(seedData.submissionTags)),
      transaction.insert(submissionParticipants).values(rows(seedData.submissionParticipants)),
      transaction.insert(reviews).values(rows(seedData.reviews)),
      transaction.insert(taskAssignments).values(rows(seedData.taskAssignments)),
      transaction.insert(portalFormResponses).values(rows(seedData.portalFormResponses)),
      transaction.insert(emailLog).values(rows(seedData.emailLog)),
    ]);
  });
};
