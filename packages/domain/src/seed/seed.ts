import {
  accounts,
  contactEditHistory,
  contacts,
  embeds,
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
// A confirmed speaker's profile edit awaiting organizer review: Maya's live
// bio carries her pending rewrite while approvedProfile keeps the version
// public surfaces render until Dana approves it in /admin/content.
const mayaContact = seedData.contacts.find((contact) => contact.id === "con_01");
const mayaApprovedBio = mayaContact?.bio ?? "";
const mayaPendingBio =
  "Maya builds retrieval systems that serve hundreds of millions of queries at Retrieval Labs, where she leads the answerability program — deciding when a model should refuse to synthesize instead of guessing. She speaks regularly about retrieval quality in production.";
const mayaApprovedProfile = {
  firstName: mayaContact?.firstName ?? "",
  lastName: mayaContact?.lastName ?? "",
  pronouns: mayaContact?.pronouns ?? null,
  bio: mayaApprovedBio,
  linkedinUrl: mayaContact?.linkedinUrl ?? null,
  twitterUrl: mayaContact?.twitterUrl ?? null,
  facebookUrl: mayaContact?.facebookUrl ?? null,
  websiteUrl: mayaContact?.websiteUrl ?? null,
  headshotUrl: mayaContact?.headshotUrl ?? null,
  headshotKey: null,
};
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

// The demo ships with the agenda already published — the same snapshot the
// publish action would write — so public views work on a judge's first load.
const roomNameById = new Map(seedData.rooms.map((room) => [room.id, room.name]));
const trackById = new Map<string, (typeof seedData.tracks)[number]>(
  seedData.tracks.map((track) => [track.id, track]),
);
const contactById = new Map(seedData.contacts.map((contact) => [contact.id, contact]));
const publishedAgenda = submissionRows
  .flatMap((submission) => {
    const roomName =
      submission.roomId === null ? undefined : roomNameById.get(submission.roomId ?? "");
    if (
      submission.status !== "accepted" ||
      submission.startsAt == null ||
      submission.endsAt == null ||
      roomName === undefined
    )
      return [];
    return [
      {
        id: submission.id,
        code: submission.code,
        title: submission.title,
        description: submission.description,
        startsAt: submission.startsAt.toISOString(),
        endsAt: submission.endsAt.toISOString(),
        roomName,
        tracks: (trackIdsBySubmission.get(submission.id) ?? []).flatMap((trackId) => {
          const track = trackById.get(trackId);
          return track === undefined
            ? []
            : [{ id: track.id, name: track.name, color: track.color }];
        }),
        speakers: seedData.submissionParticipants
          .filter(
            (participant) =>
              participant.submissionId === submission.id && participant.role === "speaker",
          )
          .flatMap((participant) => {
            const contact = contactById.get(participant.contactId);
            return contact === undefined
              ? []
              : [{ id: contact.id, name: `${contact.firstName} ${contact.lastName}` }];
          }),
      },
    ];
  })
  .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
const eventRows = seedData.events.map((event) => ({
  ...event,
  publishedAgenda,
  agendaPublishedAt: new Date(1785672000000),
  agendaDirty: false,
}));

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
      transaction.insert(events).values(rows(eventRows)),
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
          ...(contact.id === "con_01"
            ? {
                bio: mayaPendingBio,
                approvedProfile: mayaApprovedProfile,
                profileReviewStatus: "pending_review" as const,
              }
            : {}),
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
      transaction.insert(embeds).values([
        {
          id: "emb_agenda_dark",
          eventId: "evt_aie_nyc_2026",
          name: "Dark agenda",
          view: "agenda",
          enabled: true,
          options: {
            trackIds: ["trk_agents"],
            formatIds: [],
            tagIds: [],
            theme: "dark",
            primaryColor: "#4caf82",
            dateFormat: "12h",
            showSpeakerCompany: true,
            showSpeakerTitle: true,
            showSpeakerBio: true,
            showSessionDescription: true,
            showSessionLevel: true,
            showSessionFormat: true,
            showAddToCalendar: true,
          },
          createdAt: seededAt,
          updatedAt: seededAt,
        },
        {
          id: "emb_speaker_gallery",
          eventId: "evt_aie_nyc_2026",
          name: "Speaker gallery",
          view: "speaker_gallery",
          enabled: true,
          options: {
            trackIds: [],
            formatIds: [],
            tagIds: [],
            theme: "auto",
            primaryColor: null,
            dateFormat: "12h",
            showSpeakerCompany: false,
            showSpeakerTitle: true,
            showSpeakerBio: true,
            showSessionDescription: true,
            showSessionLevel: true,
            showSessionFormat: true,
            showAddToCalendar: true,
          },
          createdAt: seededAt,
          updatedAt: seededAt,
        },
      ]),
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
      transaction.insert(contactEditHistory).values({
        id: "che_maya_bio",
        contactId: "con_01",
        authorContactId: "con_01",
        authorEventMemberId: null,
        authorName: "Maya Chen",
        changedFields: ["bio"],
        previousValues: { bio: mayaApprovedBio },
        newValues: { bio: mayaPendingBio },
        approvalStatus: "pending_review",
        reviewedAt: null,
        reviewedByEventMemberId: null,
        createdAt: new Date(1785672000000),
        updatedAt: new Date(1785672000000),
      }),
    ]);
  });
};
