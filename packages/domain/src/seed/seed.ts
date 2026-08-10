import {
  contacts,
  emailLog,
  eventMembers,
  events,
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
import { type Database, wipeSeedData } from "../server/db";
import { seedData } from "./data";

const seededAt = new Date(1785585600000);
const rows = <A extends object>(values: ReadonlyArray<A>) => values.map((value) => ({ ...value }));

export const seedDatabase = async (database: Database) => {
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
      ]),
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
      transaction.insert(contacts).values(rows(seedData.contacts)),
      transaction.insert(portalForms).values(rows(seedData.portalForms)),
    ]);

    await Promise.all([
      transaction.insert(reviewerTracks).values(rows(seedData.reviewerTracks)),
      transaction.insert(formFields).values(rows(seedData.formFields)),
      transaction.insert(submissions).values(rows(seedData.submissions)),
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
