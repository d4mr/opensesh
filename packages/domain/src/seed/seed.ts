import {
  accounts,
  crmPipelineCards,
  crmPipelineStages,
  agendaBlocks,
  crmSegments,
  crmStageHistory,
  contactEditHistory,
  contacts,
  embeds,
  emailLog,
  eventMembers,
  events,
  fileComments,
  fileRequests,
  fileUploads,
  fileVersions,
  formFields,
  formats,
  forms,
  levels,
  organizationMembers,
  organizationContactEvents,
  organizationContactTags,
  organizationContacts,
  organizationTags,
  organizations,
  portalFormResponses,
  portalForms,
  reviewerTracks,
  resources,
  reviews,
  rooms,
  sessionFileRequirementAssignments,
  sessionFileRequirements,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  taskAssignments,
  taskTemplates,
  tracks,
  users,
  submissionActivity,
} from "../db/schema";
import { hashPassword } from "better-auth/crypto";
import { DEMO_ORG_ID, DEMO_PASSWORD, EVAL_ORG_ID } from "../demo";
import {
  type Database,
  organizationStorageKeys,
  wipeOrganizationData,
  wipeSeedData,
} from "../server/db";
import * as mailTemplates from "@opensesh/email";
import { seedData } from "./data";

const seededAt = new Date(1785585600000);
const sessionFileAssignmentId = (
  requirementId: string,
  submissionId: string,
  contactId: string | null,
) => `sfra_${requirementId}_${submissionId}_${contactId ?? "shared"}`;
// The eval workspace holds ONLY what the SessionBoard Eval Kit cannot create
// through the product: password accounts for its published personas, and the
// organization Jordan operates in. Every contact, event, submission, round,
// and CRM record is created by the evaluator itself — pre-seeding them turns
// the kit's create flows into awkward duplicate-handling paths.
const evalUsers = [
  {
    id: "usr_jordan",
    email: "jordan.organizer@sbek-test.example.com",
    name: "Jordan Alvarez",
    password: "SbekTest!2027-org",
  },
  {
    id: "usr_priya",
    email: "priya.speaker@sbek-test.example.com",
    name: "Priya Raman",
    password: "SbekTest!2027-spk",
  },
  {
    id: "usr_marcus",
    email: "marcus.speaker@sbek-test.example.com",
    name: "Marcus Okafor",
    password: "SbekTest!2027-spk2",
  },
  {
    id: "usr_sam",
    email: "sam.reviewer@sbek-test.example.com",
    name: "Sam Whitfield",
    password: "SbekTest!2027-rev",
  },
  {
    id: "usr_alex",
    email: "alex.attendee@sbek-test.example.com",
    name: "Alex Attendee",
    password: "SbekTest!2027-att",
  },
] as const;
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
  // Only accepted sessions carry approved public content — everything still in
  // review is born unapproved, exactly as the CFP intake writes it.
  const approved = submission.status === "accepted";
  const approvedSnapshot: (typeof submissions.$inferInsert)["approvedSnapshot"] = approved
    ? {
        title: submission.title,
        description: submission.description,
        formatId: submission.formatId,
        levelId: submission.levelId,
        language: submission.language,
        answers,
      }
    : {};
  // Mateo cancelled SESS-17 after acceptance: the acceptance stands as
  // history, the session left the agenda, and the demo shows the full
  // cancelled state (annotated desk row, cancelled Sessions row, timeline).
  const cancelled = submission.id === "sub_17";
  return {
    ...submission,
    ...(submission.sourceFormId === null ? { submitterContactId: null } : {}),
    scheduleDirty: false,
    answers,
    approvedSnapshot,
    contentReviewStatus: approved ? ("approved" as const) : ("pending_review" as const),
    cancelledAt: cancelled ? new Date(1783820400000) : null,
    cancelledBy: cancelled ? ("speaker" as const) : null,
    // The cancellation email carried an ICS CANCEL, which bumps the sequence.
    ...(cancelled ? { icsSequence: 1 } : {}),
  };
});

// The activity log a live pipeline would have written: decisions for every
// decided row, the schedule moves for placed sessions, and Mateo's
// cancellation — so timelines are rich on a fresh seed.
const submissionActivityRows = [
  ...submissionRows.flatMap((submission) => {
    if (submission.status !== "accepted" && submission.status !== "declined") return [];
    if (submission.sourceFormId === null) return [];
    return [
      {
        id: `act_decided_${submission.id}`,
        submissionId: submission.id,
        type: "decided" as const,
        actorContactId: null,
        actorUserId: "usr_dana",
        actorApiKeyId: null,
        actorName: "Dana Organizer",
        payload: {
          decision: submission.status === "accepted" ? "accept" : "decline",
          from: "pending",
        },
        createdAt: new Date(1783080000000),
        updatedAt: new Date(1783080000000),
      },
    ];
  }),
  ...submissionRows.flatMap((submission) =>
    submission.status !== "accepted" || submission.startsAt === null
      ? []
      : [
          {
            id: `act_scheduled_${submission.id}`,
            submissionId: submission.id,
            type: "scheduled" as const,
            actorContactId: null,
            actorUserId: "usr_dana",
            actorApiKeyId: null,
            actorName: "Dana Organizer",
            payload: {
              startsAt: submission.startsAt.toISOString(),
              endsAt: submission.endsAt?.toISOString() ?? null,
              roomId: submission.roomId,
              roomName:
                submission.roomId === null
                  ? null
                  : (seedData.rooms.find((room) => room.id === submission.roomId)?.name ?? null),
            },
            createdAt: new Date(1783616000000),
            updatedAt: new Date(1783616000000),
          },
        ],
  ),
  {
    id: "act_cancelled_sub_17",
    submissionId: "sub_17",
    type: "cancelled" as const,
    actorContactId: "con_14",
    actorUserId: null,
    actorApiKeyId: null,
    actorName: "Mateo Silva",
    payload: { cause: "speaker" },
    createdAt: new Date(1783820400000),
    updatedAt: new Date(1783820400000),
  },
];

// The demo ships with the agenda already published — the same snapshot the
// publish action would write — so public views work on a judge's first load.
const roomNameById = new Map(seedData.rooms.map((room) => [room.id, room.name]));
const trackById = new Map<string, (typeof seedData.tracks)[number]>(
  seedData.tracks.map((track) => [track.id, track]),
);
const contactById = new Map(seedData.contacts.map((contact) => [contact.id, contact]));
const submissionById = new Map(
  seedData.submissions.map((submission) => [submission.id, submission]),
);

// Seeded emails carry the same branded HTML the runtime templates send, so
// the Email delivery viewer shows real bodies on a fresh seed.
const emailLogRows = seedData.emailLog.map((row) => {
  const submission = row.submissionId === null ? undefined : submissionById.get(row.submissionId);
  const contact = row.contactId === null ? undefined : contactById.get(row.contactId);
  if (submission === undefined || contact === undefined) return row;
  const template = {
    eventName: "AI.Engineer Sandbox — NYC 2026",
    portalUrl: "https://opensesh.d4mr.workers.dev/portal",
    logoUrl: null,
  };
  const rendered =
    row.type === "confirmation"
      ? mailTemplates.confirmation({
          ...template,
          name: contact.firstName,
          submissionTitle: submission.title,
        })
      : row.type === "accepted"
        ? mailTemplates.accepted({
            ...template,
            speakerName: contact.firstName,
            submissionTitle: submission.title,
            feedback: "",
          })
        : row.type === "declined"
          ? mailTemplates.declined({
              ...template,
              speakerName: contact.firstName,
              submissionTitle: submission.title,
              feedback: "",
            })
          : row.type === "cancelled"
            ? mailTemplates.cancelled({
                ...template,
                speakerName: contact.firstName,
                submissionTitle: submission.title,
                cause: "speaker",
                message:
                  "Completely understood about the travel conflict — we hope to see this talk at the next edition.",
              })
            : null;
  return rendered === null
    ? row
    : { ...row, subject: rendered.subject, body: rendered.text, htmlBody: rendered.html };
});
const publishedAgenda = submissionRows
  .flatMap((submission) => {
    const roomName =
      submission.roomId === null ? undefined : roomNameById.get(submission.roomId ?? "");
    if (
      submission.status !== "accepted" ||
      submission.cancelledAt !== null ||
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
const publishedBlocks = seedData.agendaBlocks.map((block) => ({
  id: block.id,
  title: block.title,
  kind: block.kind,
  roomName: block.roomId === null ? null : (roomNameById.get(block.roomId) ?? null),
  startsAt: block.startsAt.toISOString(),
  endsAt: block.endsAt.toISOString(),
}));
const eventRows = seedData.events.map((event) => ({
  ...event,
  publishedAgenda,
  publishedBlocks,
  agendaPublishedAt: new Date(1785672000000),
  agendaDirty: false,
}));

const organizationContactRows = seedData.contacts.map((contact) => ({
  id: `orgcon_${contact.id}`,
  organizationId: DEMO_ORG_ID,
  firstName: contact.firstName,
  lastName: contact.lastName,
  email: contact.email,
  title: contact.title,
  company: contact.company,
  bio: contact.bio,
  linkedinUrl: contact.linkedinUrl,
  twitterUrl: contact.twitterUrl,
  facebookUrl: contact.facebookUrl,
  websiteUrl: contact.websiteUrl,
  headshotUrl: contact.headshotUrl,
  custom: {},
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const organizationContactEventRows = seedData.contacts.map((contact) => ({
  id: `orgconevt_${contact.id}`,
  organizationContactId: `orgcon_${contact.id}`,
  contactId: contact.id,
  eventId: contact.eventId,
  role: "speaker",
  status: seedData.submissions.some(
    (submission) =>
      submission.status === "accepted" &&
      seedData.submissionParticipants.some(
        (participant) =>
          participant.submissionId === submission.id && participant.contactId === contact.id,
      ),
  )
    ? "confirmed"
    : "invited",
  createdAt: seededAt,
  updatedAt: seededAt,
}));

const dayMs = 86_400_000;
const organizationTagRows = [
  { id: "orgtag_keynote", name: "Keynote potential" },
  { id: "orgtag_repeat", name: "Repeat speaker" },
  { id: "orgtag_workshop", name: "Workshop host" },
].map((tag) => ({
  ...tag,
  organizationId: "org_ai_engineer",
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const organizationContactTagRows = [
  ["orgcon_con_01", "orgtag_repeat"],
  ["orgcon_con_06", "orgtag_repeat"],
  ["orgcon_con_10", "orgtag_repeat"],
  ["orgcon_con_05", "orgtag_keynote"],
  ["orgcon_con_19", "orgtag_keynote"],
  ["orgcon_con_13", "orgtag_workshop"],
].map(([organizationContactId, tagId]) => ({
  id: `orgcontag_${organizationContactId.replace("orgcon_", "")}_${tagId.replace("orgtag_", "")}`,
  organizationContactId,
  tagId,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const crmPipelineCardRows = [
  {
    id: "crmcard_yuki",
    organizationContactId: "orgcon_con_17",
    stageId: "crm_stage_prospect",
    note: "Strong GPU-scheduling talk at KubeCon — sound out for a 2027 infra keynote.",
    movedAt: seededAt.getTime() + dayMs,
  },
  {
    id: "crmcard_elena",
    organizationContactId: "orgcon_con_18",
    stageId: "crm_stage_prospect",
    note: "Referred by Mei; writes the Eval Notes newsletter.",
    movedAt: seededAt.getTime() + dayMs,
  },
  {
    id: "crmcard_mei",
    organizationContactId: "orgcon_con_24",
    stageId: "crm_stage_contacted",
    note: "Intro email sent — waiting on topic ideas.",
    movedAt: seededAt.getTime() + 3 * dayMs,
  },
  {
    id: "crmcard_jamal",
    organizationContactId: "orgcon_con_19",
    stageId: "crm_stage_confirmed",
    note: "Confirmed for a closing keynote slot; hold Main Stage.",
    movedAt: seededAt.getTime() + 5 * dayMs,
  },
  {
    id: "crmcard_amara",
    organizationContactId: "orgcon_con_07",
    stageId: "crm_stage_declined",
    note: "On sabbatical through spring — revisit next cycle.",
    movedAt: seededAt.getTime() + 4 * dayMs,
  },
].map(({ movedAt, ...card }) => ({
  ...card,
  ownerUserId: "usr_dana",
  createdAt: seededAt,
  updatedAt: new Date(movedAt),
}));
const crmStageHistoryRows = [
  { id: "crmhist_yuki_1", cardId: "crmcard_yuki", from: null, to: "crm_stage_prospect", day: 1 },
  { id: "crmhist_elena_1", cardId: "crmcard_elena", from: null, to: "crm_stage_prospect", day: 1 },
  { id: "crmhist_mei_1", cardId: "crmcard_mei", from: null, to: "crm_stage_prospect", day: 1 },
  {
    id: "crmhist_mei_2",
    cardId: "crmcard_mei",
    from: "crm_stage_prospect",
    to: "crm_stage_contacted",
    day: 3,
  },
  { id: "crmhist_jamal_1", cardId: "crmcard_jamal", from: null, to: "crm_stage_prospect", day: 1 },
  {
    id: "crmhist_jamal_2",
    cardId: "crmcard_jamal",
    from: "crm_stage_prospect",
    to: "crm_stage_contacted",
    day: 2,
  },
  {
    id: "crmhist_jamal_3",
    cardId: "crmcard_jamal",
    from: "crm_stage_contacted",
    to: "crm_stage_confirmed",
    day: 5,
  },
  { id: "crmhist_amara_1", cardId: "crmcard_amara", from: null, to: "crm_stage_prospect", day: 1 },
  {
    id: "crmhist_amara_2",
    cardId: "crmcard_amara",
    from: "crm_stage_prospect",
    to: "crm_stage_declined",
    day: 4,
  },
].map((entry) => ({
  id: entry.id,
  cardId: entry.cardId,
  fromStageId: entry.from,
  toStageId: entry.to,
  actorUserId: "usr_dana",
  createdAt: new Date(seededAt.getTime() + entry.day * dayMs),
}));

type SeedTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Inserts the demo workspace. `withIdentities` also creates the persona users
// and credential accounts — the cron reset skips that part so live sessions
// survive a reseed.
export const seedDemoOrg = async (transaction: SeedTransaction, withIdentities: boolean) => {
  const inserts: Array<Promise<unknown>> = [
    transaction.insert(organizations).values({
      id: DEMO_ORG_ID,
      name: "AI.Engineer",
      slug: "ai-engineer",
      logo: null,
      metadata: null,
      createdAt: seededAt,
    }),
  ];
  if (withIdentities) {
    const password = await hashPassword(DEMO_PASSWORD);
    inserts.push(
      transaction.insert(users).values(rows(seedData.users)),
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
    );
  }
  await Promise.all(inserts);

  await Promise.all([
    transaction.insert(organizationMembers).values([
      {
        id: "org_mem_dana",
        organizationId: DEMO_ORG_ID,
        userId: "usr_dana",
        role: "owner",
        createdAt: seededAt,
      },
      {
        id: "org_mem_rey",
        organizationId: DEMO_ORG_ID,
        userId: "usr_rey",
        role: "member",
        createdAt: seededAt,
      },
    ]),
    transaction.insert(events).values(rows(eventRows)),
  ]);

  await Promise.all([
    transaction.insert(eventMembers).values(rows(seedData.eventMembers)),
    transaction.insert(tracks).values(rows(seedData.tracks)),
    transaction.insert(tags).values(rows(seedData.tags)),
    transaction.insert(formats).values(rows(seedData.formats)),
    transaction.insert(levels).values(rows(seedData.levels)),
    transaction.insert(rooms).values(rows(seedData.rooms)),
    transaction.insert(agendaBlocks).values(rows(seedData.agendaBlocks)),
    transaction.insert(forms).values(rows(seedData.forms)),
    transaction.insert(contacts).values(
      seedData.contacts.map((contact) => {
        const accepted = seedData.submissions.some(
          (submission) =>
            submission.status === "accepted" &&
            seedData.submissionParticipants.some(
              (participant) =>
                participant.submissionId === submission.id && participant.contactId === contact.id,
            ),
        );
        const submittedCfp = seedData.submissions.some(
          (submission) =>
            submission.sourceFormId !== null &&
            (submission.submitterContactId === contact.id ||
              seedData.submissionParticipants.some(
                (participant) =>
                  participant.submissionId === submission.id &&
                  participant.contactId === contact.id,
              )),
        );
        return {
          ...contact,
          participation: submittedCfp ? ("submitter" as const) : ("speaker" as const),
          ...(contact.id === "con_01"
            ? {
                bio: mayaPendingBio,
                approvedProfile: mayaApprovedProfile,
                profileReviewStatus: "pending_review" as const,
              }
            : {}),
          confirmedAt:
            accepted && contact.id !== "con_22" && contact.id !== "con_16"
              ? new Date(1783080000000)
              : null,
        };
      }),
    ),
    transaction.insert(organizationContacts).values(organizationContactRows),
    transaction.insert(organizationTags).values(organizationTagRows),
    transaction.insert(crmSegments).values({
      id: "crmseg_repeat_speakers",
      organizationId: DEMO_ORG_ID,
      name: "Repeat speakers",
      filter: { search: "", company: "", title: "", tagIds: ["orgtag_repeat"] },
      createdAt: seededAt,
      updatedAt: seededAt,
    }),
    transaction.insert(crmPipelineStages).values(
      [
        {
          id: "crm_stage_prospect",
          name: "Prospect",
          semanticStatus: "open" as const,
          position: 1,
        },
        {
          id: "crm_stage_contacted",
          name: "Contacted",
          semanticStatus: "open" as const,
          position: 2,
        },
        {
          id: "crm_stage_confirmed",
          name: "Confirmed",
          semanticStatus: "won" as const,
          position: 3,
        },
        {
          id: "crm_stage_declined",
          name: "Declined",
          semanticStatus: "lost" as const,
          position: 4,
        },
      ].map((stage) => ({
        ...stage,
        organizationId: DEMO_ORG_ID,
        createdAt: seededAt,
        updatedAt: seededAt,
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
    transaction.insert(resources).values(rows(seedData.resources)),
    transaction.insert(fileRequests).values(rows(seedData.fileRequests)),
    transaction.insert(sessionFileRequirements).values(rows(seedData.sessionFileRequirements)),
  ]);

  await Promise.all([
    transaction.insert(reviewerTracks).values(rows(seedData.reviewerTracks)),
    transaction.insert(formFields).values(rows(seedData.formFields)),
    transaction.insert(submissions).values(submissionRows),
    transaction.insert(taskTemplates).values(rows(seedData.taskTemplates)),
    transaction.insert(organizationContactEvents).values(organizationContactEventRows),
    transaction.insert(organizationContactTags).values(organizationContactTagRows),
    transaction.insert(crmPipelineCards).values(crmPipelineCardRows),
  ]);

  await Promise.all([
    transaction.insert(submissionTracks).values(rows(seedData.submissionTracks)),
    transaction.insert(submissionTags).values(rows(seedData.submissionTags)),
    transaction.insert(submissionParticipants).values(rows(seedData.submissionParticipants)),
    transaction.insert(reviews).values(rows(seedData.reviews)),
    transaction.insert(taskAssignments).values(rows(seedData.taskAssignments)),
    transaction.insert(portalFormResponses).values(rows(seedData.portalFormResponses)),
    transaction.insert(emailLog).values(rows(emailLogRows)),
    transaction.insert(submissionActivity).values(submissionActivityRows),
    transaction.insert(crmStageHistory).values(crmStageHistoryRows),
    transaction.insert(contactEditHistory).values({
      id: "che_maya_bio",
      contactId: "con_01",
      authorContactId: "con_01",
      authorUserId: null,
      authorName: "Maya Chen",
      changedFields: ["bio"],
      previousValues: { bio: mayaApprovedBio },
      newValues: { bio: mayaPendingBio },
      approvalStatus: "pending_review",
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: new Date(1785672000000),
      updatedAt: new Date(1785672000000),
    }),
  ]);

  const acceptedSubmissionIds = new Set<string>(
    seedData.submissions.flatMap((submission) =>
      submission.status === "accepted" ? [submission.id] : [],
    ),
  );
  const acceptedParticipants = seedData.submissionParticipants.filter((participant) =>
    acceptedSubmissionIds.has(participant.submissionId),
  );
  const fileAssignmentRows = seedData.sessionFileRequirements.flatMap((requirement) => {
    const targets =
      requirement.scope === "submission"
        ? Array.from(acceptedSubmissionIds, (submissionId) => ({ submissionId, contactId: null }))
        : acceptedParticipants.map((participant) => ({
            submissionId: participant.submissionId,
            contactId: participant.contactId,
          }));
    return targets.map((target) => {
      const id = sessionFileAssignmentId(requirement.id, target.submissionId, target.contactId);
      return {
        id,
        requirementId: requirement.id,
        submissionId: target.submissionId,
        contactId: target.contactId,
        status: seedData.fileUploads.some((upload) => upload.assignmentId === id)
          ? ("uploaded" as const)
          : ("outstanding" as const),
        createdAt: seededAt,
        updatedAt: seededAt,
      };
    });
  });
  await transaction.insert(sessionFileRequirementAssignments).values(fileAssignmentRows);
  await transaction.insert(fileUploads).values(rows(seedData.fileUploads));

  await Promise.all([
    transaction.insert(fileVersions).values(rows(seedData.fileVersions)),
    transaction.insert(fileComments).values(rows(seedData.fileComments)),
  ]);
};

// Inserts the eval workspace: the organization Jordan owns and, when
// `withIdentities`, the five persona accounts with their published fixture
// passwords. Nothing else — the evaluator creates its own data.
export const seedEvalOrg = async (transaction: SeedTransaction, withIdentities: boolean) => {
  if (withIdentities) {
    const credentials = await Promise.all(
      evalUsers.map(async (user) => ({ id: user.id, password: await hashPassword(user.password) })),
    );
    await transaction.insert(users).values(
      evalUsers.map(({ password: _password, ...user }) => ({
        ...user,
        emailVerified: true,
        image: null,
        createdAt: seededAt,
        updatedAt: seededAt,
      })),
    );
    await transaction.insert(accounts).values(
      credentials.map((credential) => ({
        id: `acc_${credential.id}`,
        accountId: credential.id,
        providerId: "credential",
        userId: credential.id,
        password: credential.password,
        createdAt: seededAt,
        updatedAt: seededAt,
      })),
    );
  }
  await transaction.insert(organizations).values({
    id: EVAL_ORG_ID,
    name: "DevFlow",
    slug: "devflow",
    logo: null,
    metadata: null,
    createdAt: seededAt,
  });
  await transaction.insert(organizationMembers).values({
    id: "org_mem_usr_jordan",
    organizationId: EVAL_ORG_ID,
    userId: "usr_jordan",
    role: "owner",
    createdAt: seededAt,
  });
};

export const seedDatabase = async (database: Database) => {
  await wipeSeedData(database);
  await database.transaction(async (transaction) => {
    await seedDemoOrg(transaction, true);
    await seedEvalOrg(transaction, true);
  });
};

// The 15-minute sandbox reset: wipe the demo workspace's data, reseed it, and
// report which R2 objects became orphans. Users, accounts, and sessions stay,
// so anyone mid-demo keeps their sign-in and simply sees fresh data.
export const resetDemoOrg = async (database: Database) => {
  const storageKeys = await organizationStorageKeys(database, DEMO_ORG_ID);
  await wipeOrganizationData(database, DEMO_ORG_ID);
  await database.transaction((transaction) => seedDemoOrg(transaction, false));
  return [...storageKeys, `organizations/${DEMO_ORG_ID}/icon`];
};

// Manual pre-judging cleanup: restore the eval workspace to pristine
// prerequisites. Persona accounts and their passwords are untouched.
export const resetEvalOrg = async (database: Database) => {
  const storageKeys = await organizationStorageKeys(database, EVAL_ORG_ID);
  await wipeOrganizationData(database, EVAL_ORG_ID);
  await database.transaction((transaction) => seedEvalOrg(transaction, false));
  return [...storageKeys, `organizations/${EVAL_ORG_ID}/icon`];
};
