import {
  accounts,
  crmPipelineCards,
  crmPipelineStages,
  crmSegments,
  crmStageHistory,
  contactEditHistory,
  contacts,
  embeds,
  emailLog,
  emailTemplates,
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
  reminderRules,
  reviewCriteria,
  reviewRoundMembers,
  reviewRounds,
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
} from "../db/schema";
import { hashPassword } from "better-auth/crypto";
import { type Database, wipeSeedData } from "../server/db";
import * as mailTemplates from "../server/mail/templates";
import { seedData } from "./data";

const seededAt = new Date(1785585600000);
const DEMO_PASSWORD = "demo-pass-2027";
const sessionFileAssignmentId = (
  requirementId: string,
  submissionId: string,
  contactId: string | null,
) => `sfra_${requirementId}_${submissionId}_${contactId ?? "shared"}`;
const devflowUsers = [
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
] as const;
const devflowEvent = {
  id: "evt_devflow_2027",
  organizationId: "org_ai_engineer",
  name: "DevFlow Conf 2027",
  slug: "devflow-conf-2027",
  tagline: "The developer workflow conference",
  description:
    "A practical conference for the people improving how software is designed, built, tested, and shipped.",
  type: "conference",
  websiteUrl: null,
  location: "Moscone West, San Francisco, CA",
  timezone: "America/Los_Angeles",
  startsAt: new Date("2027-05-12T16:00:00.000Z"),
  endsAt: new Date("2027-05-15T01:00:00.000Z"),
  theme: null,
  logoUrl: null,
  logoKey: null,
  backgroundUrl: null,
  defaultSubmissionLimit: 4,
  agendaPublishedAt: null,
  publishedAgenda: [],
  agendaDirty: false,
  createdAt: seededAt,
  updatedAt: seededAt,
};
const devflowEventMembers = [
  {
    id: "mem_jordan_devflow",
    eventId: devflowEvent.id,
    userId: "usr_jordan",
    role: "admin" as const,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: "mem_sam_devflow",
    eventId: devflowEvent.id,
    userId: "usr_sam",
    role: "reviewer" as const,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
];
const devflowTracks = [
  { id: "trk_devflow_ai", name: "AI Engineering", color: "#2563eb", position: 1 },
  { id: "trk_devflow_platform", name: "Platform & Infra", color: "#7c3aed", position: 2 },
  { id: "trk_devflow_dx", name: "Developer Experience", color: "#0f766e", position: 3 },
].map((track) => ({
  ...track,
  eventId: devflowEvent.id,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const devflowFormats = [
  { id: "fmt_devflow_keynote", name: "Keynote", durationMinutes: 45, position: 1 },
  { id: "fmt_devflow_talk", name: "Talk", durationMinutes: 30, position: 2 },
  { id: "fmt_devflow_lightning", name: "Lightning Talk", durationMinutes: 10, position: 3 },
  { id: "fmt_devflow_workshop", name: "Workshop", durationMinutes: 120, position: 4 },
  { id: "fmt_devflow_panel", name: "Panel", durationMinutes: 45, position: 5 },
].map((format) => ({
  ...format,
  eventId: devflowEvent.id,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const devflowLevels = ["Beginner", "Intermediate", "Advanced"].map((name, index) => ({
  id: `lvl_devflow_${name.toLowerCase()}`,
  eventId: devflowEvent.id,
  name,
  position: index + 1,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const devflowRooms = ["Main Stage", "Room 2A", "Room 2B", "Workshop Lab"].map((name, index) => ({
  id: `room_devflow_${index + 1}`,
  eventId: devflowEvent.id,
  name,
  position: index + 1,
  capacity: null,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const devflowForm = {
  id: "form_devflow_cfp",
  eventId: devflowEvent.id,
  internalName: "DevFlow Conf 2027 CFP",
  externalTitle: "Speak at DevFlow Conf 2027",
  kind: "abstract" as const,
  collectParticipants: true,
  status: "open" as const,
  welcomeHeading: "Welcome",
  welcomeMessage: "Share the concrete workflow lesson you want practitioners to take home.",
  showWelcome: true,
  abstractSection: {
    title: "Your proposal",
    heading: "Proposal",
    instructions: "Describe the problem, the approach, and what attendees will learn.",
  },
  participantSection: {
    title: "Presenters",
    heading: "Speakers",
    instructions: "Add everyone who will present this session.",
  },
  participantRoles: [
    { role: "Primary speaker", enabled: true, min: 1, max: 1 },
    { role: "Co-presenter", enabled: true, min: 0, max: 3 },
  ],
  closeDate: new Date("2026-11-30T23:59:00.000Z"),
  submissionLimit: 4,
  allowMultipleDrafts: true,
  successMessage: "Thanks — your proposal is in review.",
  autoRedirectPortal: true,
  confirmationEmailEnabled: true,
  confirmationEmailBody: "We received {{submission.title}} for DevFlow Conf 2027.",
  adminAlertUserIds: ["usr_jordan"],
  createdAt: seededAt,
  updatedAt: seededAt,
};
const devflowFormFields = [
  ...(
    [
      {
        id: "fld_devflow_title",
        label: "Title",
        fieldType: "text",
        maxChars: 255,
        mapsTo: "title",
        position: 1,
      },
      {
        id: "fld_devflow_description",
        label: "Description",
        fieldType: "richtext",
        maxChars: 5000,
        mapsTo: "description",
        position: 2,
      },
      {
        id: "fld_devflow_format",
        label: "Format",
        fieldType: "dropdown",
        maxChars: null,
        mapsTo: "format_id",
        position: 3,
      },
      {
        id: "fld_devflow_track",
        label: "Track",
        fieldType: "dropdown",
        maxChars: null,
        mapsTo: "tracks",
        position: 4,
      },
      {
        id: "fld_devflow_level",
        label: "Audience level",
        fieldType: "dropdown",
        maxChars: null,
        mapsTo: "level_id",
        position: 5,
      },
      {
        id: "fld_devflow_notes",
        label: "Notes for reviewers",
        fieldType: "textarea",
        maxChars: 5000,
        mapsTo: "notes_for_reviewers",
        position: 6,
      },
    ] as const
  ).map((field) => ({
    ...field,
    formId: devflowForm.id,
    section: "abstract" as const,
    required: true,
    locked: field.id === "fld_devflow_title",
    options:
      field.id === "fld_devflow_format"
        ? ({ bind: "format" } as const)
        : field.id === "fld_devflow_track"
          ? ({ bind: "track" } as const)
          : field.id === "fld_devflow_level"
            ? ({ bind: "level" } as const)
            : null,
    condition: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  })),
  ...(
    [
      {
        id: "fld_devflow_first",
        label: "First Name",
        fieldType: "text",
        mapsTo: "first_name",
        position: 1,
      },
      {
        id: "fld_devflow_last",
        label: "Last Name",
        fieldType: "text",
        mapsTo: "last_name",
        position: 2,
      },
      {
        id: "fld_devflow_email",
        label: "Email",
        fieldType: "email",
        mapsTo: "email",
        position: 3,
      },
    ] as const
  ).map((field) => ({
    ...field,
    formId: devflowForm.id,
    section: "participant" as const,
    maxChars: 255,
    required: true,
    locked: true,
    options: null,
    condition: null,
    createdAt: seededAt,
    updatedAt: seededAt,
  })),
];
const devflowContacts = [
  {
    id: "con_devflow_priya",
    email: "priya.speaker@sbek-test.example.com",
    firstName: "Priya",
    lastName: "Raman",
    title: "Principal Engineer",
    company: "Latticework Systems",
    bio: "Priya builds developer tooling at Latticework Systems, focusing on incremental build systems, CI reliability, and the feedback loops that make engineering teams more productive.",
    linkedinUrl: "https://www.linkedin.com/in/priya-raman-builds",
    twitterUrl: "@priyabuilds",
    dietaryRequirements: "vegetarian" as const,
    tshirtSize: "M" as const,
    workflowStatus: "onboarding" as const,
  },
  {
    id: "con_devflow_marcus",
    email: "marcus.speaker@sbek-test.example.com",
    firstName: "Marcus",
    lastName: "Okafor",
    title: "Staff Developer Advocate",
    company: "Cloudreach Labs",
    bio: "Marcus helps teams ship production AI agents at Cloudreach Labs. He writes Agents Weekly and organizes the SF AI Tinkerers community.",
    linkedinUrl: null,
    twitterUrl: null,
    dietaryRequirements: "none" as const,
    tshirtSize: null,
    workflowStatus: "invited" as const,
  },
].map((contact) => ({
  ...contact,
  eventId: devflowEvent.id,
  salutation: null,
  honorific: null,
  pronouns: null,
  gender: null,
  headshotUrl: null,
  headshotKey: null,
  phone: null,
  facebookUrl: null,
  websiteUrl: null,
  confirmedAt: null,
  custom: {},
  approvedProfile: {},
  profileReviewStatus: "approved" as const,
  createdAt: seededAt,
  updatedAt: seededAt,
}));
const devflowSubmissions = [
  {
    id: "sub_devflow_1",
    code: "SESS-1",
    submitterContactId: "con_devflow_priya",
    title: "Taming 40-Minute CI: Incremental Builds at Monorepo Scale",
    description:
      "A practical account of replacing full-repository CI work with trustworthy incremental builds, including dependency graphs, cache correctness, and rollout measurement.",
    formatId: "fmt_devflow_talk",
    levelId: "lvl_devflow_intermediate",
    trackId: "trk_devflow_platform",
    notes:
      "An earlier version of this material appeared at PlatformCon; this proposal adds the full migration data.",
  },
  {
    id: "sub_devflow_2",
    code: "SESS-2",
    submitterContactId: "con_devflow_priya",
    title: "Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale",
    description:
      "Verification patterns for AI-assisted development that combine executable specifications, review checkpoints, and production feedback without slowing teams down.",
    formatId: "fmt_devflow_talk",
    levelId: "lvl_devflow_advanced",
    trackId: "trk_devflow_ai",
    notes: "This talk can also be expanded into an optional workshop format.",
  },
  {
    id: "sub_devflow_3",
    code: "SESS-3",
    submitterContactId: "con_devflow_priya",
    title: "Docs That Answer Back: Retrieval-Grounded Documentation Sites",
    description:
      "How to make documentation answer real user questions while grounding every response in versioned source material and exposing uncertainty.",
    formatId: "fmt_devflow_lightning",
    levelId: "lvl_devflow_beginner",
    trackId: "trk_devflow_dx",
    notes: "A compact live walkthrough is available for the lightning-talk slot.",
  },
  {
    id: "sub_devflow_4",
    code: "SESS-4",
    submitterContactId: "con_devflow_marcus",
    title: "Lightning: Agents in Production Q&A",
    description:
      "A fast, example-led Q&A on the failure modes teams encounter when AI agents meet production systems.",
    formatId: "fmt_devflow_lightning",
    levelId: null,
    trackId: "trk_devflow_ai",
    notes: "Designed as a distinct second-speaker session for agenda and content workflows.",
  },
].map(({ trackId, notes, ...submission }) => ({
  ...submission,
  eventId: devflowEvent.id,
  kind: "abstract" as const,
  status: "pending" as const,
  sourceFormId: devflowForm.id,
  language: "en",
  startsAt: null,
  endsAt: null,
  roomId: null,
  icsSequence: 0,
  scheduleDirty: false,
  capacity: null,
  ceuCredits: null,
  clientSessionId: null,
  notifiedAt: null,
  submittedAt: new Date("2026-08-05T17:00:00.000Z"),
  answers: { fld_devflow_notes: notes },
  approvedSnapshot: {},
  contentReviewStatus: "approved" as const,
  createdAt: seededAt,
  updatedAt: seededAt,
  trackId,
}));
const devflowReviewRounds = [
  {
    id: "rnd_devflow_initial",
    eventId: devflowEvent.id,
    name: "Initial Review",
    opensAt: new Date("2026-08-01T07:00:00.000Z"),
    closesAt: new Date("2026-10-16T06:59:59.000Z"),
    blind: true,
    position: 1,
    status: "open" as const,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
  {
    id: "rnd_devflow_final",
    eventId: devflowEvent.id,
    name: "Final Review",
    opensAt: new Date("2026-10-16T07:00:00.000Z"),
    closesAt: new Date("2026-12-01T07:59:59.000Z"),
    blind: false,
    position: 2,
    status: "draft" as const,
    createdAt: seededAt,
    updatedAt: seededAt,
  },
];
const devflowReviewCriteria = [
  {
    id: "crit_devflow_originality",
    roundId: "rnd_devflow_initial",
    label: "Originality",
    type: "numeric" as const,
    min: 1,
    max: 5,
    options: [],
    required: true,
    weight: 2,
    position: 1,
  },
  {
    id: "crit_devflow_relevance",
    roundId: "rnd_devflow_initial",
    label: "Relevance",
    type: "numeric" as const,
    min: 1,
    max: 5,
    options: [],
    required: true,
    weight: 1,
    position: 2,
  },
  {
    id: "crit_devflow_recommendation",
    roundId: "rnd_devflow_initial",
    label: "Recommendation",
    type: "dropdown" as const,
    min: null,
    max: null,
    options: ["Accept", "Maybe", "Reject"],
    required: true,
    weight: 1,
    position: 3,
  },
  {
    id: "crit_devflow_comments",
    roundId: "rnd_devflow_initial",
    label: "Comments",
    type: "text" as const,
    min: null,
    max: null,
    options: [],
    required: false,
    weight: 1,
    position: 4,
  },
  {
    id: "crit_devflow_final_score",
    roundId: "rnd_devflow_final",
    label: "Final Score",
    type: "numeric" as const,
    min: 1,
    max: 10,
    options: [],
    required: true,
    weight: 1,
    position: 1,
  },
  {
    id: "crit_devflow_final_comments",
    roundId: "rnd_devflow_final",
    label: "Comments",
    type: "text" as const,
    min: null,
    max: null,
    options: [],
    required: false,
    weight: 1,
    position: 2,
  },
].map((criterion) => ({ ...criterion, createdAt: seededAt, updatedAt: seededAt }));
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
const eventRows = [
  ...seedData.events.map((event) => ({
    ...event,
    publishedAgenda,
    agendaPublishedAt: new Date(1785672000000),
    agendaDirty: false,
  })),
  devflowEvent,
];

const organizationContactRows = [...seedData.contacts, ...devflowContacts].map((contact) => ({
  id: `orgcon_${contact.id}`,
  organizationId: "org_ai_engineer",
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
const organizationContactEventRows = [...seedData.contacts, ...devflowContacts].map((contact) => ({
  id: `orgconevt_${contact.id}`,
  organizationContactId: `orgcon_${contact.id}`,
  contactId: contact.id,
  eventId: contact.eventId,
  role: "speaker",
  status:
    contact.eventId === devflowEvent.id
      ? (devflowContacts.find((item) => item.id === contact.id)?.workflowStatus ?? "invited")
      : seedData.submissions.some(
            (submission) =>
              submission.status === "accepted" &&
              seedData.submissionParticipants.some(
                (participant) =>
                  participant.submissionId === submission.id &&
                  participant.contactId === contact.id,
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

export const seedDatabase = async (database: Database) => {
  const password = await hashPassword(DEMO_PASSWORD);
  const devflowPasswords = new Map(
    await Promise.all(
      devflowUsers.map(async (user) => [user.id, await hashPassword(user.password)] as const),
    ),
  );
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
      transaction.insert(users).values([
        ...rows(seedData.users),
        ...devflowUsers.map(({ password: _password, ...user }) => ({
          ...user,
          emailVerified: true,
          image: null,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ]),
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
        ...devflowUsers
          .filter((user) => user.id === "usr_jordan" || user.id === "usr_sam")
          .map((user) => ({
            id: `org_mem_${user.id}`,
            organizationId: "org_ai_engineer",
            userId: user.id,
            role: "member",
            createdAt: seededAt,
          })),
      ]),
      transaction.insert(accounts).values([
        ...seedData.users.map((user) => ({
          id: `acc_${user.id}`,
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
        ...devflowUsers.map((user) => ({
          id: `acc_${user.id}`,
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: devflowPasswords.get(user.id),
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ]),
      transaction.insert(events).values(rows(eventRows)),
    ]);

    await Promise.all([
      transaction
        .insert(eventMembers)
        .values([...rows(seedData.eventMembers), ...devflowEventMembers]),
      transaction.insert(tracks).values([...rows(seedData.tracks), ...devflowTracks]),
      transaction.insert(tags).values(rows(seedData.tags)),
      transaction.insert(formats).values([...rows(seedData.formats), ...devflowFormats]),
      transaction.insert(levels).values([...rows(seedData.levels), ...devflowLevels]),
      transaction.insert(rooms).values([...rows(seedData.rooms), ...devflowRooms]),
      transaction.insert(forms).values([...rows(seedData.forms), devflowForm]),
      transaction.insert(contacts).values([
        ...seedData.contacts.map((contact) => {
          const accepted = seedData.submissions.some(
            (submission) =>
              submission.status === "accepted" &&
              seedData.submissionParticipants.some(
                (participant) =>
                  participant.submissionId === submission.id &&
                  participant.contactId === contact.id,
              ),
          );
          const declined = seedData.submissions.some(
            (submission) =>
              submission.status === "declined" &&
              seedData.submissionParticipants.some(
                (participant) =>
                  participant.submissionId === submission.id &&
                  participant.contactId === contact.id,
              ),
          );
          return {
            ...contact,
            ...(contact.id === "con_01"
              ? {
                  bio: mayaPendingBio,
                  approvedProfile: mayaApprovedProfile,
                  profileReviewStatus: "pending_review" as const,
                }
              : {}),
            workflowStatus: accepted
              ? ("confirmed" as const)
              : declined
                ? ("declined" as const)
                : ("invited" as const),
            confirmedAt: accepted ? new Date(1788264000000) : null,
          };
        }),
        ...devflowContacts,
      ]),
      transaction.insert(reviewRounds).values(devflowReviewRounds),
      transaction.insert(emailTemplates).values({
        id: "email_template_devflow_acceptance",
        eventId: devflowEvent.id,
        name: "Acceptance",
        subjectTemplate: "Your talk has been accepted to DevFlow Conf 2027",
        bodyTemplate: "Hello {speaker_name}, your session {talk_title} has been accepted.",
        mergeFields: ["speaker_name", "talk_title"],
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
      transaction.insert(reminderRules).values({
        id: "reminder_devflow_tasks",
        eventId: devflowEvent.id,
        scope: "contact",
        taskType: "incomplete_task",
        daysBeforeDue: 3,
        enabled: false,
        lastRunAt: null,
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
      transaction.insert(organizationContacts).values(organizationContactRows),
      transaction.insert(organizationTags).values(organizationTagRows),
      transaction.insert(crmSegments).values({
        id: "crmseg_repeat_speakers",
        organizationId: "org_ai_engineer",
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
          organizationId: "org_ai_engineer",
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
      transaction.insert(fileRequests).values(rows(seedData.fileRequests)),
      transaction.insert(sessionFileRequirements).values(rows(seedData.sessionFileRequirements)),
    ]);

    await Promise.all([
      transaction.insert(reviewerTracks).values(rows(seedData.reviewerTracks)),
      transaction.insert(formFields).values([...rows(seedData.formFields), ...devflowFormFields]),
      transaction
        .insert(submissions)
        .values([
          ...submissionRows,
          ...devflowSubmissions.map(({ trackId: _trackId, ...submission }) => submission),
        ]),
      transaction.insert(taskTemplates).values(rows(seedData.taskTemplates)),
      transaction.insert(reviewCriteria).values(devflowReviewCriteria),
      transaction.insert(reviewRoundMembers).values({
        id: "rndmem_devflow_sam",
        roundId: "rnd_devflow_initial",
        eventMemberId: "mem_sam_devflow",
        assignmentCap: null,
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
      transaction.insert(organizationContactEvents).values(organizationContactEventRows),
      transaction.insert(organizationContactTags).values(organizationContactTagRows),
      transaction.insert(crmPipelineCards).values(crmPipelineCardRows),
    ]);

    await Promise.all([
      transaction.insert(submissionTracks).values([
        ...rows(seedData.submissionTracks),
        ...devflowSubmissions.map((submission) => ({
          id: `substrk_${submission.id}`,
          submissionId: submission.id,
          trackId: submission.trackId,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ]),
      transaction.insert(submissionTags).values(rows(seedData.submissionTags)),
      transaction.insert(submissionParticipants).values([
        ...rows(seedData.submissionParticipants),
        {
          id: "subpart_devflow_1_priya",
          submissionId: "sub_devflow_1",
          contactId: "con_devflow_priya",
          role: "Primary speaker",
          position: 1,
          createdAt: seededAt,
          updatedAt: seededAt,
        },
        {
          id: "subpart_devflow_1_marcus",
          submissionId: "sub_devflow_1",
          contactId: "con_devflow_marcus",
          role: "Co-presenter",
          position: 2,
          createdAt: seededAt,
          updatedAt: seededAt,
        },
        ...["sub_devflow_2", "sub_devflow_3"].map((submissionId, index) => ({
          id: `subpart_${submissionId}_priya`,
          submissionId,
          contactId: "con_devflow_priya",
          role: "Primary speaker",
          position: 1,
          createdAt: new Date(seededAt.getTime() + index),
          updatedAt: seededAt,
        })),
        {
          id: "subpart_devflow_4_marcus",
          submissionId: "sub_devflow_4",
          contactId: "con_devflow_marcus",
          role: "Primary speaker",
          position: 1,
          createdAt: seededAt,
          updatedAt: seededAt,
        },
      ]),
      transaction.insert(reviews).values(rows(seedData.reviews)),
      transaction.insert(taskAssignments).values(rows(seedData.taskAssignments)),
      transaction.insert(portalFormResponses).values(rows(seedData.portalFormResponses)),
      transaction.insert(emailLog).values(rows(emailLogRows)),
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
  });
};
