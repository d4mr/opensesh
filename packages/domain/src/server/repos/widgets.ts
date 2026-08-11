import { and, asc, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  contactEditHistory,
  contacts,
  emailLog,
  embeds,
  events,
  fileRequests,
  fileUploads,
  fileVersions,
  formats,
  levels,
  sessionFileRequirements,
  sessionFileRequirementAssignments,
  submissionParticipants,
  submissions,
  submissionTags,
  tags,
  taskAssignments,
  taskTemplates,
} from "../../db/schema";
import { Db } from "../db";
import { NotFound, type DbError } from "../errors";
import {
  defaultWidgetOptions,
  dedupeSpeakerCsvRows,
  PublicProgram,
  PublicSession,
  type SpeakerCsvRow,
  SpeakerDirectory,
  Widget,
  type WidgetOptions,
  type WidgetView,
} from "../schema/widgets";
import { decode, decodeFound, decodeMany, query } from "./shared";

type EventRow = typeof events.$inferSelect;
type SubmissionRow = typeof submissions.$inferSelect;
type ContactRow = typeof contacts.$inferSelect;
interface ProgramRow {
  readonly event: EventRow;
  readonly submission: SubmissionRow | null;
  readonly format: typeof formats.$inferSelect | null;
  readonly level: typeof levels.$inferSelect | null;
  readonly tag: typeof tags.$inferSelect | null;
  readonly contact: ContactRow | null;
}
type SessionProgramRow = ProgramRow & { readonly submission: SubmissionRow };

export const publicSubmissionVisible = (
  submission: Pick<SubmissionRow, "status" | "contentReviewStatus">,
) => submission.status === "accepted" && submission.contentReviewStatus === "approved";

export const findPublicSession = (program: PublicProgram, code: string) =>
  program.sessions.find((session) => session.code === code) ??
  new NotFound({ message: "Public session not found" });

// Confirmed speakers' public-facing fields come from the last organizer-
// approved profile snapshot (see portal repo); an empty snapshot means no
// gated edit has happened yet, so the live row is already approved.
const publicProfileValue = <Key extends "firstName" | "lastName" | "bio" | "headshotUrl">(
  contact: ContactRow,
  key: Key,
): ContactRow[Key] => {
  if (contact.confirmedAt === null || Object.keys(contact.approvedProfile).length === 0)
    return contact[key];
  const approved = (contact.approvedProfile as Readonly<Record<string, unknown>>)[key];
  return (
    approved === null || typeof approved === "string" ? approved : contact[key]
  ) as ContactRow[Key];
};

const publicHeadshotKey = (contact: ContactRow) => {
  if (contact.confirmedAt === null || Object.keys(contact.approvedProfile).length === 0)
    return contact.headshotKey;
  const approved = contact.approvedProfile.headshotKey;
  return typeof approved === "string" || approved === null ? approved : contact.headshotKey;
};

const publicHeadshotUrl = (contact: ContactRow) =>
  publicHeadshotKey(contact) === null
    ? publicProfileValue(contact, "headshotUrl")
    : `/speaker-assets/${contact.id}/headshot`;

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const normalizeOptions = (value: Readonly<Record<string, unknown>>): WidgetOptions => ({
  trackIds: strings(value.trackIds),
  formatIds: strings(value.formatIds),
  tagIds: strings(value.tagIds),
  dayKeys: strings(value.dayKeys),
  theme:
    value.theme === "light" || value.theme === "dark" || value.theme === "auto"
      ? value.theme
      : "auto",
  primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : null,
  dateFormat: value.dateFormat === "24h" ? "24h" : "12h",
  showSpeakerCompany: bool(value.showSpeakerCompany, true),
  showSpeakerTitle: bool(value.showSpeakerTitle, true),
  showSpeakerBio: bool(value.showSpeakerBio, true),
  showSessionDescription: bool(value.showSessionDescription, true),
  showSessionLevel: bool(value.showSessionLevel, true),
  showSessionFormat: bool(value.showSessionFormat, true),
  showAddToCalendar: bool(value.showAddToCalendar, true),
});
const widgetValue = (row: typeof embeds.$inferSelect) => ({
  ...row,
  options: normalizeOptions(row.options),
});
const approvedString = (row: SubmissionRow, key: "title" | "description", fallback: string) => {
  const value = row.approvedSnapshot[key];
  return typeof value === "string" ? value : fallback;
};
const approvedId = (row: SubmissionRow, key: "formatId" | "levelId", fallback: string | null) => {
  const value = row.approvedSnapshot[key];
  return typeof value === "string" || value === null ? value : fallback;
};
const unique = <A extends { readonly id: string }>(items: ReadonlyArray<A>) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const programFromRows = (rows: ReadonlyArray<ProgramRow>) =>
  Effect.gen(function* () {
    const first = rows[0];
    if (first === undefined) return yield* decodeFound(PublicProgram, "Public event", undefined);
    const event = first.event;
    const schedule = new Map(event.publishedAgenda.map((item) => [item.id, item]));
    const grouped = new Map<string, Array<SessionProgramRow>>();
    for (const row of rows) {
      if (
        row.submission !== null &&
        publicSubmissionVisible(row.submission) &&
        schedule.has(row.submission.id)
      )
        grouped.set(row.submission.id, [
          ...(grouped.get(row.submission.id) ?? []),
          { ...row, submission: row.submission },
        ]);
    }
    const sessions = Array.from(grouped.values())
      .flatMap((group) => {
        const row = group[0];
        if (row === undefined) return [];
        const slot = schedule.get(row.submission.id);
        if (slot === undefined) return [];
        const formatId = approvedId(row.submission, "formatId", row.submission.formatId);
        const levelId = approvedId(row.submission, "levelId", row.submission.levelId);
        const format = group.find((item) => item.format?.id === formatId)?.format ?? null;
        const level = group.find((item) => item.level?.id === levelId)?.level ?? null;
        return [
          {
            id: row.submission.id,
            code: row.submission.code,
            title: approvedString(row.submission, "title", row.submission.title),
            description: approvedString(row.submission, "description", row.submission.description),
            format: format === null ? null : { id: format.id, name: format.name },
            level: level === null ? null : { id: level.id, name: level.name },
            tracks: slot.tracks,
            tags: unique(group.flatMap((item) => (item.tag === null ? [] : [item.tag]))).map(
              (item) => ({ id: item.id, name: item.name }),
            ),
            speakers: unique(
              group.flatMap((item) =>
                item.contact !== null &&
                slot.speakers.some((speaker) => speaker.id === item.contact?.id)
                  ? [item.contact]
                  : [],
              ),
            ).map((item) => ({
              id: item.id,
              firstName: publicProfileValue(item, "firstName"),
              lastName: publicProfileValue(item, "lastName"),
              title: item.title,
              company: item.company,
              bio: publicProfileValue(item, "bio"),
              headshotUrl: publicHeadshotUrl(item),
            })),
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            roomName: slot.roomName,
          },
        ];
      })
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    return yield* decode(PublicProgram, "public program", {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        tagline: event.tagline,
        description: event.description,
        logoUrl: event.logoUrl,
        location: event.location,
        timezone: event.timezone,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        agendaPublishedAt: event.agendaPublishedAt?.toISOString() ?? null,
      },
      tracks: unique(sessions.flatMap((item) => item.tracks)),
      formats: unique(sessions.flatMap((item) => (item.format === null ? [] : [item.format]))),
      tags: unique(sessions.flatMap((item) => item.tags)),
      sessions,
    });
  });

const csvCell = (value: string | null) => {
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const dietary = (value: string) => {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "vegetarian" || normalized === "vegan" || normalized === "gluten_free")
    return normalized;
  return normalized.length === 0 || normalized === "none" ? "none" : "other";
};
const tshirt = (value: string | null) => {
  const normalized = value?.trim().toUpperCase();
  return normalized === "XS" ||
    normalized === "S" ||
    normalized === "M" ||
    normalized === "L" ||
    normalized === "XL" ||
    normalized === "XXL"
    ? normalized
    : null;
};

interface WidgetsService {
  readonly publicProgram: (slug: string) => Effect.Effect<PublicProgram, DbError | NotFound>;
  readonly publicSession: (
    slug: string,
    code: string,
  ) => Effect.Effect<PublicSession, DbError | NotFound>;
  readonly publicSpeakerHeadshot: (contactId: string) => Effect.Effect<string, DbError | NotFound>;
  readonly publicWidget: (
    id: string,
  ) => Effect.Effect<{ widget: Widget; program: PublicProgram }, DbError | NotFound>;
  readonly list: (eventId: string) => Effect.Effect<ReadonlyArray<Widget>, DbError>;
  readonly create: (
    eventId: string,
    name: string,
    view: WidgetView,
  ) => Effect.Effect<Widget, DbError>;
  readonly update: (input: {
    readonly id: string;
    readonly eventId: string;
    readonly name: string;
    readonly view: WidgetView;
    readonly enabled: boolean;
    readonly options: WidgetOptions;
  }) => Effect.Effect<Widget, DbError | NotFound>;
  readonly directory: (eventId: string) => Effect.Effect<SpeakerDirectory, DbError>;
  readonly importSpeakers: (
    eventId: string,
    rows: ReadonlyArray<SpeakerCsvRow>,
  ) => Effect.Effect<{ created: number; updated: number; skipped: number }, DbError>;
}

export class Widgets extends Context.Service<Widgets, WidgetsService>()("opensesh/Widgets") {}

export const WidgetsLive = Layer.effect(
  Widgets,
  Effect.gen(function* () {
    const { database } = yield* Db;
    const programJoins = (db: typeof database) =>
      db
        .select({
          event: events,
          submission: submissions,
          format: formats,
          level: levels,
          tag: tags,
          contact: contacts,
        })
        .from(events)
        .leftJoin(
          submissions,
          and(
            eq(submissions.eventId, events.id),
            eq(submissions.status, "accepted"),
            eq(submissions.contentReviewStatus, "approved"),
          ),
        )
        .leftJoin(formats, eq(formats.eventId, events.id))
        .leftJoin(levels, eq(levels.eventId, events.id))
        .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
        .leftJoin(tags, eq(tags.id, submissionTags.tagId))
        .leftJoin(submissionParticipants, eq(submissionParticipants.submissionId, submissions.id))
        .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId));
    const loadPublicProgram = (slug: string) =>
      query(database, "Could not load public program", (db) =>
        programJoins(db).where(eq(events.slug, slug)).execute(),
      ).pipe(Effect.flatMap(programFromRows));
    return {
      publicProgram: loadPublicProgram,
      publicSession: (slug, code) =>
        loadPublicProgram(slug).pipe(
          Effect.flatMap((program) => {
            const session = findPublicSession(program, code);
            return session instanceof NotFound
              ? Effect.fail(session)
              : decodeFound(PublicSession, "Public session", session);
          }),
        ),
      publicSpeakerHeadshot: (contactId) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load public speaker headshot", (db) =>
            db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).execute(),
          );
          const contact = rows[0];
          const storageKey = contact === undefined ? null : publicHeadshotKey(contact);
          if (storageKey === null) {
            return yield* Effect.fail(new NotFound({ message: "Headshot not found" }));
          }
          return storageKey;
        }),
      publicWidget: (id) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load widget program", (db) =>
            db
              .select({
                widget: embeds,
                event: events,
                submission: submissions,
                format: formats,
                level: levels,
                tag: tags,
                contact: contacts,
              })
              .from(embeds)
              .innerJoin(events, eq(events.id, embeds.eventId))
              .leftJoin(
                submissions,
                and(
                  eq(submissions.eventId, events.id),
                  eq(submissions.status, "accepted"),
                  eq(submissions.contentReviewStatus, "approved"),
                ),
              )
              .leftJoin(formats, eq(formats.eventId, events.id))
              .leftJoin(levels, eq(levels.eventId, events.id))
              .leftJoin(submissionTags, eq(submissionTags.submissionId, submissions.id))
              .leftJoin(tags, eq(tags.id, submissionTags.tagId))
              .leftJoin(
                submissionParticipants,
                eq(submissionParticipants.submissionId, submissions.id),
              )
              .leftJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
              .where(eq(embeds.id, id))
              .execute(),
          );
          const source = rows[0]?.widget;
          const widget = yield* decodeFound(
            Widget,
            "Widget",
            source === undefined ? undefined : widgetValue(source),
          );
          return { widget, program: yield* programFromRows(rows) };
        }),
      list: (eventId) =>
        query(database, "Could not list widgets", (db) =>
          db
            .select()
            .from(embeds)
            .where(eq(embeds.eventId, eventId))
            .orderBy(asc(embeds.name))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Widget, "widget", rows.map(widgetValue)))),
      create: (eventId, name, view) =>
        query(database, "Could not create widget", (db) =>
          db
            .insert(embeds)
            .values({ eventId, name, view, enabled: true, options: defaultWidgetOptions })
            .returning()
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decode(Widget, "widget", rows[0] === undefined ? undefined : widgetValue(rows[0])),
          ),
        ),
      update: (input) =>
        query(database, "Could not update widget", (db) =>
          db
            .update(embeds)
            .set({
              name: input.name,
              view: input.view,
              enabled: input.enabled,
              options: input.options,
              updatedAt: new Date(),
            })
            .where(and(eq(embeds.id, input.id), eq(embeds.eventId, input.eventId)))
            .returning()
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeFound(Widget, "Widget", rows[0] === undefined ? undefined : widgetValue(rows[0])),
          ),
        ),
      directory: (eventId) =>
        Effect.gen(function* () {
          const [rows, assignmentRows, fileRows, emailRows, profileRows] = yield* Effect.all(
            [
              query(database, "Could not load speaker directory", (db) =>
                db
                  .select({ contact: contacts, submission: submissions })
                  .from(contacts)
                  .leftJoin(
                    submissionParticipants,
                    eq(submissionParticipants.contactId, contacts.id),
                  )
                  .leftJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                  .where(eq(contacts.eventId, eventId))
                  .orderBy(asc(contacts.lastName), asc(contacts.firstName))
                  .execute(),
              ),
              query(database, "Could not load speaker tasks", (db) =>
                db
                  .select({
                    assignment: taskAssignments,
                    template: taskTemplates,
                    submission: submissions,
                  })
                  .from(taskAssignments)
                  .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                  .leftJoin(submissions, eq(submissions.id, taskAssignments.submissionId))
                  .where(eq(taskTemplates.eventId, eventId))
                  .orderBy(asc(taskTemplates.position))
                  .execute(),
              ),
              query(database, "Could not load speaker files", (db) =>
                db
                  .select({
                    upload: fileUploads,
                    version: fileVersions,
                    request: fileRequests,
                    requirement: sessionFileRequirements,
                    assignment: sessionFileRequirementAssignments,
                    contact: contacts,
                  })
                  .from(fileUploads)
                  .innerJoin(fileVersions, eq(fileVersions.fileUploadId, fileUploads.id))
                  .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
                  .leftJoin(fileRequests, eq(fileRequests.id, fileUploads.fileRequestId))
                  .leftJoin(
                    sessionFileRequirements,
                    eq(sessionFileRequirements.id, fileUploads.requirementId),
                  )
                  .leftJoin(
                    sessionFileRequirementAssignments,
                    eq(sessionFileRequirementAssignments.id, fileUploads.assignmentId),
                  )
                  .where(eq(contacts.eventId, eventId))
                  .orderBy(desc(fileVersions.uploadedAt))
                  .execute(),
              ),
              query(database, "Could not load speaker emails", (db) =>
                db
                  .select()
                  .from(emailLog)
                  .where(eq(emailLog.eventId, eventId))
                  .orderBy(desc(emailLog.createdAt))
                  .execute(),
              ),
              query(database, "Could not load speaker profile changes", (db) =>
                db
                  .select({ history: contactEditHistory, contact: contacts })
                  .from(contactEditHistory)
                  .innerJoin(contacts, eq(contacts.id, contactEditHistory.contactId))
                  .where(eq(contacts.eventId, eventId))
                  .orderBy(desc(contactEditHistory.createdAt))
                  .execute(),
              ),
            ],
            { concurrency: "unbounded" },
          );
          const grouped = new Map<
            string,
            { contact: ContactRow; submissions: Array<SubmissionRow> }
          >();
          for (const row of rows) {
            const item = grouped.get(row.contact.id) ?? { contact: row.contact, submissions: [] };
            if (
              row.submission !== null &&
              !item.submissions.some((entry) => entry.id === row.submission?.id)
            )
              item.submissions.push(row.submission);
            grouped.set(row.contact.id, item);
          }
          const currentFiles = new Map<string, (typeof fileRows)[number]>();
          for (const row of fileRows) {
            if (!currentFiles.has(row.upload.id)) currentFiles.set(row.upload.id, row);
          }
          const directoryRows = Array.from(grouped.values()).map(
            ({ contact, submissions: linked }) => ({
              contact: {
                id: contact.id,
                email: contact.email,
                profileReviewStatus: contact.profileReviewStatus,
                firstName: contact.firstName,
                lastName: contact.lastName,
                title: contact.title,
                company: contact.company,
                bio: contact.bio,
                headshotUrl: contact.headshotUrl,
                dietaryRequirements: contact.dietaryRequirements,
                tshirtSize: contact.tshirtSize,
                phone: contact.phone,
                linkedinUrl: contact.linkedinUrl,
                twitterUrl: contact.twitterUrl,
                facebookUrl: contact.facebookUrl,
                websiteUrl: contact.websiteUrl,
                workflowStatus: contact.workflowStatus,
                custom: contact.custom,
              },
              sessions: linked.map((submission) => ({
                id: submission.id,
                code: submission.code,
                title: submission.title,
              })),
              tasks: assignmentRows
                .filter(
                  (row) =>
                    row.assignment.contactId === contact.id ||
                    (row.assignment.submissionId !== null &&
                      linked.some((submission) => submission.id === row.assignment.submissionId)),
                )
                .map((row) => ({
                  id: row.assignment.id,
                  title: row.template.title,
                  status: row.assignment.status,
                  dueDate: row.template.dueDate,
                  submissionCode: row.submission?.code ?? null,
                })),
              files: Array.from(currentFiles.values())
                .filter(
                  (row) =>
                    (row.assignment === null && row.upload.contactId === contact.id) ||
                    row.assignment?.contactId === contact.id ||
                    (row.assignment?.contactId === null &&
                      linked.some((submission) => submission.id === row.assignment?.submissionId)),
                )
                .map((row) => ({
                  id: row.upload.id,
                  versionId: row.version.id,
                  filename: row.version.filename,
                  kind: row.upload.kind,
                  label:
                    row.request?.title ??
                    row.requirement?.title ??
                    (row.upload.kind === "headshot" ? "Headshot" : "Slides"),
                  uploadedAt: row.version.uploadedAt,
                  contentType: row.version.contentType,
                  size: row.version.size,
                  uploaderName: row.version.uploaderName,
                })),
              emails: emailRows
                .filter((row) => row.contactId === contact.id)
                .slice(0, 10)
                .map((row) => ({
                  id: row.id,
                  subject: row.subject,
                  type: row.type,
                  status: row.status,
                  sentAt: row.sentAt,
                })),
              profileChanges: profileRows
                .filter((row) => row.contact.id === contact.id)
                .map(({ history }) => ({
                  id: history.id,
                  changedFields: history.changedFields,
                  previousValues: history.previousValues,
                  newValues: history.newValues,
                  authorName: history.authorName,
                  approvalStatus: history.approvalStatus,
                  reviewedAt: history.reviewedAt,
                  createdAt: history.createdAt,
                })),
            }),
          );
          const csv = [
            "first_name,last_name,email,title,company,bio,dietary,tshirt,linkedin,twitter,facebook,website,phone",
            ...Array.from(grouped.values()).map(({ contact }) =>
              [
                contact.firstName,
                contact.lastName,
                contact.email,
                contact.title,
                contact.company,
                contact.bio,
                contact.dietaryRequirements,
                contact.tshirtSize,
                contact.linkedinUrl,
                contact.twitterUrl,
                contact.facebookUrl,
                contact.websiteUrl,
                contact.phone,
              ]
                .map(csvCell)
                .join(","),
            ),
          ].join("\r\n");
          return yield* decode(SpeakerDirectory, "speaker directory", { rows: directoryRows, csv });
        }),
      importSpeakers: (eventId, inputRows) =>
        query(database, "Could not import speakers", (db) =>
          db.transaction(async (transaction) => {
            const deduped = dedupeSpeakerCsvRows(inputRows);
            let created = 0;
            let updated = 0;
            let skipped = 0;
            for (const row of deduped) {
              if (row.action === "skip") {
                skipped += 1;
                continue;
              }
              const existing = await transaction
                .select({ id: contacts.id })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.eventId, eventId),
                    eq(contacts.email, row.email.trim().toLowerCase()),
                  ),
                )
                .limit(1)
                .execute();
              if (existing[0] === undefined && row.action === "update") {
                skipped += 1;
                continue;
              }
              if (existing[0] !== undefined && row.action === "create") {
                skipped += 1;
                continue;
              }
              await transaction
                .insert(contacts)
                .values({
                  eventId,
                  email: row.email.trim().toLowerCase(),
                  firstName: row.firstName.trim(),
                  lastName: row.lastName.trim(),
                  title: row.title,
                  company: row.company,
                  bio: row.bio,
                  dietaryRequirements: dietary(row.dietary),
                  tshirtSize: tshirt(row.tshirt),
                  linkedinUrl: row.linkedin,
                  twitterUrl: row.twitter,
                  facebookUrl: row.facebook,
                  websiteUrl: row.website,
                  phone: row.phone,
                  custom: {},
                })
                .onConflictDoUpdate({
                  target: [contacts.eventId, contacts.email],
                  set: {
                    firstName: row.firstName.trim(),
                    lastName: row.lastName.trim(),
                    title: row.title,
                    company: row.company,
                    bio: row.bio,
                    dietaryRequirements: dietary(row.dietary),
                    tshirtSize: tshirt(row.tshirt),
                    linkedinUrl: row.linkedin,
                    twitterUrl: row.twitter,
                    facebookUrl: row.facebook,
                    websiteUrl: row.website,
                    phone: row.phone,
                    updatedAt: new Date(),
                  },
                })
                .execute();
              if (existing[0] === undefined) created += 1;
              else updated += 1;
            }
            return { created, updated, skipped };
          }),
        ),
    };
  }),
);
