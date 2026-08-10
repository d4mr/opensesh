import { and, asc, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contacts,
  crmPipelineCards,
  crmPipelineStages,
  crmSegments,
  crmStageHistory,
  emailCampaignRecipients,
  emailCampaigns,
  emailLog,
  events,
  organizationContactEvents,
  organizationContactNotes,
  organizationContacts,
  organizationContactTags,
  organizationTags,
  reminderRules,
  submissionParticipants,
  submissions,
} from "../../db/schema";
import { Db } from "../db";
import {
  type DbError,
  DuplicateMerge,
  Forbidden,
  InvalidPipelineMove,
  type NotFound,
} from "../errors";
import {
  EmailCampaign,
  EmailCampaignRecipient,
  ReminderRule,
  resolveMergeFields,
} from "../schema/communications";
import {
  type CrmContactDetail,
  type CrmDirectoryRow,
  CrmPipelineBoard,
  CrmPipelineCard,
  CrmPipelineStage,
  CrmSegment,
  CrmStageHistory,
  OrganizationContact,
  OrganizationContactEvent,
  OrganizationContactNote,
  OrganizationTag,
  type CrmSemanticStatus,
} from "../schema/crm";
import { decode, decodeFound, decodeMany, query } from "./shared";

type JsonObject = Readonly<Record<string, Schema.Json>>;

interface CrmService {
  readonly directory: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<CrmDirectoryRow>, DbError>;
  readonly contactDetail: (id: string) => Effect.Effect<CrmContactDetail, DbError | NotFound>;
  readonly pipelineBoard: (organizationId: string) => Effect.Effect<CrmPipelineBoard, DbError>;
  readonly addNote: (
    organizationContactId: string,
    body: string,
    authorEventMemberId: string,
  ) => Effect.Effect<OrganizationContactNote, DbError>;
  readonly saveTag: (
    organizationId: string,
    organizationContactId: string,
    name: string,
  ) => Effect.Effect<OrganizationTag, DbError>;
  readonly saveSegment: (
    organizationId: string,
    name: string,
    filter: JsonObject,
  ) => Effect.Effect<CrmSegment, DbError>;
  readonly saveStage: (input: {
    readonly id: string | null;
    readonly organizationId: string;
    readonly name: string;
    readonly semanticStatus: CrmSemanticStatus;
    readonly position: number;
  }) => Effect.Effect<CrmPipelineStage, DbError | NotFound>;
  readonly moveCard: (
    cardId: string,
    toStageId: string,
    actorEventMemberId: string,
  ) => Effect.Effect<CrmPipelineCard, DbError | NotFound | InvalidPipelineMove>;
  readonly merge: (
    primaryId: string,
    duplicateId: string,
  ) => Effect.Effect<OrganizationContact, DbError | NotFound | DuplicateMerge>;
  readonly addToEvent: (
    organizationContactId: string,
    eventId: string,
    role: string,
    status: string,
  ) => Effect.Effect<OrganizationContactEvent, DbError | NotFound | Forbidden>;
  readonly createCampaign: (input: {
    readonly eventId: string;
    readonly templateId: string | null;
    readonly subject: string;
    readonly body: string;
    readonly recipientFilter: JsonObject;
    readonly createdByEventMemberId: string;
    readonly contactIds: ReadonlyArray<string>;
  }) => Effect.Effect<
    {
      readonly campaign: EmailCampaign;
      readonly recipients: ReadonlyArray<EmailCampaignRecipient>;
    },
    DbError
  >;
  readonly sendCampaign: (campaignId: string) => Effect.Effect<EmailCampaign, DbError | NotFound>;
  readonly upsertReminderRule: (input: {
    readonly eventId: string;
    readonly scope: "contact" | "submission";
    readonly taskType: string;
    readonly daysBeforeDue: number;
    readonly enabled: boolean;
  }) => Effect.Effect<ReminderRule, DbError>;
  readonly runReminderRule: (
    id: string,
  ) => Effect.Effect<{ readonly sent: number }, DbError | NotFound>;
}

export class Crm extends Context.Service<Crm, CrmService>()("opensesh/Crm") {}

export const CrmLive = Layer.effect(
  Crm,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      directory: (organizationId) =>
        query(database, "Could not load CRM directory", (db) =>
          db
            .select({
              contact: organizationContacts,
              event: organizationContactEvents,
              tag: organizationTags,
            })
            .from(organizationContacts)
            .leftJoin(
              organizationContactEvents,
              eq(organizationContactEvents.organizationContactId, organizationContacts.id),
            )
            .leftJoin(
              organizationContactTags,
              eq(organizationContactTags.organizationContactId, organizationContacts.id),
            )
            .leftJoin(organizationTags, eq(organizationTags.id, organizationContactTags.tagId))
            .where(eq(organizationContacts.organizationId, organizationId))
            .orderBy(asc(organizationContacts.lastName), asc(organizationContacts.firstName))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.forEach(Array.from(new Set(rows.map((row) => row.contact.id))), (contactId) => {
              const group = rows.filter((row) => row.contact.id === contactId);
              const first = group[0];
              return decode(
                Schema.Struct({
                  contact: OrganizationContact,
                  tags: Schema.Array(OrganizationTag),
                  events: Schema.Array(OrganizationContactEvent),
                }),
                "CRM directory row",
                first === undefined
                  ? undefined
                  : {
                      contact: first.contact,
                      tags: Array.from(
                        new Map(
                          group.flatMap((row) => (row.tag === null ? [] : [[row.tag.id, row.tag]])),
                        ).values(),
                      ),
                      events: Array.from(
                        new Map(
                          group.flatMap((row) =>
                            row.event === null ? [] : [[row.event.id, row.event]],
                          ),
                        ).values(),
                      ),
                    },
              );
            }),
          ),
        ),
      contactDetail: (id) =>
        Effect.all(
          [
            query(database, "Could not load CRM contact", (db) =>
              db
                .select()
                .from(organizationContacts)
                .where(eq(organizationContacts.id, id))
                .limit(1)
                .execute(),
            ),
            query(database, "Could not load CRM contact events", (db) =>
              db
                .select()
                .from(organizationContactEvents)
                .where(eq(organizationContactEvents.organizationContactId, id))
                .orderBy(asc(organizationContactEvents.createdAt))
                .execute(),
            ),
            query(database, "Could not load CRM contact tags", (db) =>
              db
                .select({ tag: organizationTags })
                .from(organizationContactTags)
                .innerJoin(organizationTags, eq(organizationTags.id, organizationContactTags.tagId))
                .where(eq(organizationContactTags.organizationContactId, id))
                .orderBy(asc(organizationTags.name))
                .execute(),
            ),
            query(database, "Could not load CRM contact notes", (db) =>
              db
                .select()
                .from(organizationContactNotes)
                .where(eq(organizationContactNotes.organizationContactId, id))
                .orderBy(asc(organizationContactNotes.createdAt))
                .execute(),
            ),
            query(database, "Could not load CRM contact pipeline", (db) =>
              db
                .select({ card: crmPipelineCards, history: crmStageHistory })
                .from(crmPipelineCards)
                .leftJoin(crmStageHistory, eq(crmStageHistory.cardId, crmPipelineCards.id))
                .where(eq(crmPipelineCards.organizationContactId, id))
                .orderBy(asc(crmStageHistory.createdAt))
                .execute(),
            ),
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.flatMap(([contactRows, eventRows, tagRows, noteRows, pipelineRows]) =>
            Effect.gen(function* () {
              const contact = yield* decodeFound(
                OrganizationContact,
                "CRM contact",
                contactRows[0],
              );
              const [decodedEvents, decodedTags, decodedNotes, decodedHistory] = yield* Effect.all([
                decodeMany(OrganizationContactEvent, "CRM contact event", eventRows),
                decodeMany(
                  OrganizationTag,
                  "organization tag",
                  tagRows.map((row) => row.tag),
                ),
                decodeMany(OrganizationContactNote, "CRM contact note", noteRows),
                decodeMany(
                  CrmStageHistory,
                  "CRM stage history",
                  pipelineRows.flatMap((row) => (row.history === null ? [] : [row.history])),
                ),
              ]);
              const card =
                pipelineRows[0] === undefined
                  ? null
                  : yield* decode(CrmPipelineCard, "CRM pipeline card", pipelineRows[0].card);
              return {
                contact,
                events: decodedEvents,
                tags: decodedTags,
                notes: decodedNotes,
                card,
                stageHistory: decodedHistory,
              };
            }),
          ),
        ),
      pipelineBoard: (organizationId) =>
        query(database, "Could not load CRM pipeline", (db) =>
          db
            .select({
              stage: crmPipelineStages,
              card: crmPipelineCards,
              contact: organizationContacts,
            })
            .from(crmPipelineStages)
            .leftJoin(crmPipelineCards, eq(crmPipelineCards.stageId, crmPipelineStages.id))
            .leftJoin(
              organizationContacts,
              eq(organizationContacts.id, crmPipelineCards.organizationContactId),
            )
            .where(eq(crmPipelineStages.organizationId, organizationId))
            .orderBy(asc(crmPipelineStages.position), asc(organizationContacts.lastName))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decode(CrmPipelineBoard, "CRM pipeline board", {
              columns: Array.from(new Set(rows.map((row) => row.stage.id))).map((stageId) => {
                const group = rows.filter((row) => row.stage.id === stageId);
                const first = group[0];
                return {
                  stage: first?.stage,
                  cards: group.flatMap((row) =>
                    row.card === null || row.contact === null
                      ? []
                      : [{ card: row.card, contact: row.contact }],
                  ),
                };
              }),
            }),
          ),
        ),
      addNote: (organizationContactId, body, authorEventMemberId) =>
        query(database, "Could not add CRM note", (db) =>
          db
            .insert(organizationContactNotes)
            .values({ organizationContactId, body, authorEventMemberId })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(OrganizationContactNote, "CRM note", rows[0]))),
      saveTag: (organizationId, organizationContactId, name) =>
        query(database, "Could not save CRM tag", (db) =>
          db.transaction(async (transaction) => {
            const [tag] = await transaction
              .insert(organizationTags)
              .values({ organizationId, name })
              .onConflictDoUpdate({
                target: [organizationTags.organizationId, organizationTags.name],
                set: { updatedAt: new Date() },
              })
              .returning()
              .execute();
            if (tag !== undefined)
              await transaction
                .insert(organizationContactTags)
                .values({ organizationContactId, tagId: tag.id })
                .onConflictDoNothing()
                .execute();
            return tag;
          }),
        ).pipe(Effect.flatMap((row) => decode(OrganizationTag, "organization tag", row))),
      saveSegment: (organizationId, name, filter) =>
        query(database, "Could not save CRM segment", (db) =>
          db
            .insert(crmSegments)
            .values({ organizationId, name, filter })
            .onConflictDoUpdate({
              target: [crmSegments.organizationId, crmSegments.name],
              set: { filter, updatedAt: new Date() },
            })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(CrmSegment, "CRM segment", rows[0]))),
      saveStage: (input) => {
        const { id: stageId, ...values } = input;
        return stageId === null
          ? query(database, "Could not create CRM stage", (db) =>
              db.insert(crmPipelineStages).values(values).returning().execute(),
            ).pipe(Effect.flatMap((rows) => decode(CrmPipelineStage, "CRM stage", rows[0])))
          : query(database, "Could not update CRM stage", (db) =>
              db
                .update(crmPipelineStages)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(crmPipelineStages.id, stageId))
                .returning()
                .execute(),
            ).pipe(Effect.flatMap((rows) => decodeFound(CrmPipelineStage, "CRM stage", rows[0])));
      },
      moveCard: (cardId, toStageId, actorEventMemberId) =>
        query(database, "Could not move CRM card", (db) =>
          db.transaction(async (transaction) => {
            const [card] = await transaction
              .select({ card: crmPipelineCards, stage: crmPipelineStages })
              .from(crmPipelineCards)
              .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmPipelineCards.stageId))
              .where(eq(crmPipelineCards.id, cardId))
              .limit(1)
              .execute();
            const [target] = await transaction
              .select()
              .from(crmPipelineStages)
              .where(eq(crmPipelineStages.id, toStageId))
              .limit(1)
              .execute();
            if (card === undefined || target === undefined) return { kind: "notFound" as const };
            if (
              card.stage.organizationId !== target.organizationId ||
              card.card.stageId === toStageId
            )
              return { kind: "invalid" as const };
            const now = new Date();
            const [saved] = await transaction
              .update(crmPipelineCards)
              .set({ stageId: toStageId, updatedAt: now })
              .where(eq(crmPipelineCards.id, cardId))
              .returning()
              .execute();
            await transaction
              .insert(crmStageHistory)
              .values({
                cardId,
                fromStageId: card.card.stageId,
                toStageId,
                actorEventMemberId,
                createdAt: now,
              })
              .execute();
            return saved === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: saved };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<CrmPipelineCard, DbError | NotFound | InvalidPipelineMove> => {
              if (outcome.kind === "notFound")
                return decodeFound(CrmPipelineCard, "CRM card", undefined);
              if (outcome.kind === "invalid")
                return Effect.fail(
                  new InvalidPipelineMove({ message: "Choose a different stage in this pipeline" }),
                );
              return decode(CrmPipelineCard, "CRM card", outcome.row);
            },
          ),
        ),
      merge: (primaryId, duplicateId) =>
        query(database, "Could not merge CRM contacts", (db) =>
          db.transaction(async (transaction) => {
            if (primaryId === duplicateId) return { kind: "duplicate" as const };
            const selected = await transaction
              .select()
              .from(organizationContacts)
              .where(inArray(organizationContacts.id, [primaryId, duplicateId]))
              .execute();
            const primary = selected.find((contact) => contact.id === primaryId);
            const duplicate = selected.find((contact) => contact.id === duplicateId);
            if (primary === undefined || duplicate === undefined)
              return { kind: "notFound" as const };
            if (primary.organizationId !== duplicate.organizationId)
              return { kind: "duplicate" as const };
            const duplicateTags = await transaction
              .select({ tagId: organizationContactTags.tagId })
              .from(organizationContactTags)
              .where(eq(organizationContactTags.organizationContactId, duplicateId))
              .execute();
            if (duplicateTags.length > 0)
              await transaction
                .insert(organizationContactTags)
                .values(
                  duplicateTags.map((tag) => ({
                    organizationContactId: primaryId,
                    tagId: tag.tagId,
                  })),
                )
                .onConflictDoNothing()
                .execute();
            const duplicateLinks = await transaction
              .select()
              .from(organizationContactEvents)
              .where(eq(organizationContactEvents.organizationContactId, duplicateId))
              .execute();
            for (const link of duplicateLinks) {
              await transaction
                .insert(organizationContactEvents)
                .values({
                  organizationContactId: primaryId,
                  contactId: link.contactId,
                  eventId: link.eventId,
                  role: link.role,
                  status: link.status,
                })
                .onConflictDoNothing()
                .execute();
            }
            await transaction
              .update(organizationContactNotes)
              .set({ organizationContactId: primaryId })
              .where(eq(organizationContactNotes.organizationContactId, duplicateId))
              .execute();
            const cards = await transaction
              .select()
              .from(crmPipelineCards)
              .where(inArray(crmPipelineCards.organizationContactId, [primaryId, duplicateId]))
              .execute();
            const primaryCard = cards.find((card) => card.organizationContactId === primaryId);
            const duplicateCard = cards.find((card) => card.organizationContactId === duplicateId);
            if (duplicateCard !== undefined) {
              if (primaryCard === undefined)
                await transaction
                  .update(crmPipelineCards)
                  .set({ organizationContactId: primaryId, updatedAt: new Date() })
                  .where(eq(crmPipelineCards.id, duplicateCard.id))
                  .execute();
              else {
                await transaction
                  .update(crmStageHistory)
                  .set({ cardId: primaryCard.id })
                  .where(eq(crmStageHistory.cardId, duplicateCard.id))
                  .execute();
                await transaction
                  .delete(crmPipelineCards)
                  .where(eq(crmPipelineCards.id, duplicateCard.id))
                  .execute();
              }
            }
            await transaction
              .delete(organizationContacts)
              .where(eq(organizationContacts.id, duplicateId))
              .execute();
            return { kind: "ok" as const, row: primary };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<OrganizationContact, DbError | NotFound | DuplicateMerge> => {
              if (outcome.kind === "notFound")
                return decodeFound(OrganizationContact, "CRM contact", undefined);
              if (outcome.kind === "duplicate")
                return Effect.fail(
                  new DuplicateMerge({ message: "Choose two contacts in the same organization" }),
                );
              return decode(OrganizationContact, "CRM contact", outcome.row);
            },
          ),
        ),
      addToEvent: (organizationContactId, eventId, role, status) =>
        query(database, "Could not add CRM contact to event", (db) =>
          db.transaction(async (transaction) => {
            const [canonical] = await transaction
              .select()
              .from(organizationContacts)
              .where(eq(organizationContacts.id, organizationContactId))
              .limit(1)
              .execute();
            const [event] = await transaction
              .select()
              .from(events)
              .where(eq(events.id, eventId))
              .limit(1)
              .execute();
            if (canonical === undefined || event === undefined)
              return { kind: "notFound" as const };
            if (canonical.organizationId !== event.organizationId)
              return { kind: "forbidden" as const };
            const [contact] = await transaction
              .insert(contacts)
              .values({
                eventId,
                email: canonical.email,
                firstName: canonical.firstName,
                lastName: canonical.lastName,
                title: canonical.title,
                company: canonical.company,
                bio: canonical.bio,
                headshotUrl: canonical.headshotUrl,
                linkedinUrl: canonical.linkedinUrl,
                twitterUrl: canonical.twitterUrl,
                facebookUrl: canonical.facebookUrl,
                websiteUrl: canonical.websiteUrl,
                custom: canonical.custom,
              })
              .onConflictDoUpdate({
                target: [contacts.eventId, contacts.email],
                set: {
                  firstName: canonical.firstName,
                  lastName: canonical.lastName,
                  title: canonical.title,
                  company: canonical.company,
                  bio: canonical.bio,
                  updatedAt: new Date(),
                },
              })
              .returning()
              .execute();
            if (contact === undefined) return { kind: "notFound" as const };
            const [link] = await transaction
              .insert(organizationContactEvents)
              .values({ organizationContactId, contactId: contact.id, eventId, role, status })
              .onConflictDoUpdate({
                target: [organizationContactEvents.contactId],
                set: { organizationContactId, eventId, role, status, updatedAt: new Date() },
              })
              .returning()
              .execute();
            return link === undefined
              ? { kind: "notFound" as const }
              : { kind: "ok" as const, row: link };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<OrganizationContactEvent, DbError | NotFound | Forbidden> => {
              if (outcome.kind === "notFound")
                return decodeFound(OrganizationContactEvent, "CRM event link", undefined);
              if (outcome.kind === "forbidden")
                return Effect.fail(
                  new Forbidden({ message: "Contact and event must share an organization" }),
                );
              return decode(OrganizationContactEvent, "CRM event link", outcome.row);
            },
          ),
        ),
      createCampaign: (input) =>
        query(database, "Could not create email campaign", (db) =>
          db.transaction(async (transaction) => {
            const recipientRows =
              input.contactIds.length === 0
                ? []
                : await transaction
                    .select({ contact: contacts, submission: submissions })
                    .from(contacts)
                    .leftJoin(
                      submissionParticipants,
                      eq(submissionParticipants.contactId, contacts.id),
                    )
                    .leftJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                    .where(
                      and(
                        eq(contacts.eventId, input.eventId),
                        inArray(contacts.id, input.contactIds),
                      ),
                    )
                    .execute();
            const [campaign] = await transaction
              .insert(emailCampaigns)
              .values({
                eventId: input.eventId,
                templateId: input.templateId,
                subjectSnapshot: input.subject,
                bodySnapshot: input.body,
                recipientFilter: input.recipientFilter,
                createdByEventMemberId: input.createdByEventMemberId,
              })
              .returning()
              .execute();
            if (campaign === undefined) return { campaign, recipients: [] };
            const grouped = Array.from(new Set(recipientRows.map((row) => row.contact.id))).map(
              (contactId) => {
                const group = recipientRows.filter((row) => row.contact.id === contactId);
                const first = group[0];
                const speakerName =
                  first === undefined ? "" : `${first.contact.firstName} ${first.contact.lastName}`;
                const talkTitle =
                  group.find((row) => row.submission !== null)?.submission?.title ?? "";
                return {
                  campaignId: campaign.id,
                  contactId,
                  resolvedSubject: resolveMergeFields(input.subject, {
                    speaker_name: speakerName,
                    talk_title: talkTitle,
                  }),
                  resolvedBody: resolveMergeFields(input.body, {
                    speaker_name: speakerName,
                    talk_title: talkTitle,
                  }),
                };
              },
            );
            const recipients =
              grouped.length === 0
                ? []
                : await transaction
                    .insert(emailCampaignRecipients)
                    .values(grouped)
                    .returning()
                    .execute();
            return { campaign, recipients };
          }),
        ).pipe(
          Effect.flatMap((result) =>
            Effect.gen(function* () {
              const campaign = yield* decode(EmailCampaign, "email campaign", result.campaign);
              const recipients = yield* decodeMany(
                EmailCampaignRecipient,
                "email campaign recipient",
                result.recipients,
              );
              return { campaign, recipients };
            }),
          ),
        ),
      sendCampaign: (campaignId) =>
        query(database, "Could not send email campaign", (db) =>
          db.transaction(async (transaction) => {
            const [campaign] = await transaction
              .select()
              .from(emailCampaigns)
              .where(eq(emailCampaigns.id, campaignId))
              .limit(1)
              .execute();
            if (campaign === undefined) return undefined;
            const recipients = await transaction
              .select({ recipient: emailCampaignRecipients, contact: contacts })
              .from(emailCampaignRecipients)
              .innerJoin(contacts, eq(contacts.id, emailCampaignRecipients.contactId))
              .where(eq(emailCampaignRecipients.campaignId, campaignId))
              .execute();
            const now = new Date();
            for (const row of recipients) {
              const [logged] = await transaction
                .insert(emailLog)
                .values({
                  eventId: campaign.eventId,
                  contactId: row.contact.id,
                  submissionId: null,
                  type: "custom",
                  recipient: row.contact.email,
                  subject: row.recipient.resolvedSubject,
                  body: row.recipient.resolvedBody,
                  htmlBody: row.recipient.resolvedBody,
                  status: "demo",
                  provider: "demo",
                  sentAt: now,
                })
                .returning({ id: emailLog.id })
                .execute();
              await transaction
                .update(emailCampaignRecipients)
                .set({
                  deliveryStatus: "sent",
                  emailLogId: logged?.id ?? null,
                  updatedAt: now,
                })
                .where(eq(emailCampaignRecipients.id, row.recipient.id))
                .execute();
            }
            const [saved] = await transaction
              .update(emailCampaigns)
              .set({ status: "sent", sentAt: now, updatedAt: now })
              .where(eq(emailCampaigns.id, campaignId))
              .returning()
              .execute();
            return saved;
          }),
        ).pipe(Effect.flatMap((row) => decodeFound(EmailCampaign, "Email campaign", row))),
      upsertReminderRule: (input) =>
        query(database, "Could not save reminder rule", (db) =>
          db
            .insert(reminderRules)
            .values(input)
            .onConflictDoUpdate({
              target: [reminderRules.eventId, reminderRules.scope, reminderRules.taskType],
              set: {
                daysBeforeDue: input.daysBeforeDue,
                enabled: input.enabled,
                updatedAt: new Date(),
              },
            })
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decode(ReminderRule, "reminder rule", rows[0]))),
      runReminderRule: (id) =>
        query(database, "Could not run reminder rule", (db) =>
          db
            .update(reminderRules)
            .set({ lastRunAt: new Date(), updatedAt: new Date() })
            .where(eq(reminderRules.id, id))
            .returning({ id: reminderRules.id })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? decodeFound(ReminderRule, "Reminder rule", undefined).pipe(
                  Effect.map(() => ({ sent: 0 })),
                )
              : Effect.succeed({ sent: 0 }),
          ),
        ),
    };
  }),
);
