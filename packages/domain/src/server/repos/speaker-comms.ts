import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contactEditHistory,
  contacts,
  emailCampaignRecipients,
  emailCampaigns,
  emailLog,
  emailTemplates,
  events,
  reminderRules,
  submissionParticipants,
  submissions,
  taskAssignments,
  taskTemplates,
} from "../../db/schema";
import { Db } from "../db";
import { type DbError, InvalidInput, type NotFound } from "../errors";
import type { AuditActor } from "../schema/common";
import {
  buildCampaignRecipientRows,
  CommunicationCenter,
  EmailCampaign,
  EmailTemplate,
  type PortalInvitationResult,
  ReminderRule,
  reminderAlreadyRanInWindow,
  reminderAssignmentsWithinWindow,
  type SpeakerProfileMutationRequest,
} from "../schema/communications";
import { Contact, type SpeakerWorkflowStatus } from "../schema/submissions";
import { decode, decodeFound, query } from "./shared";

type SpeakerInput = typeof SpeakerProfileMutationRequest.Type;

interface SpeakerCommsService {
  readonly saveSpeaker: (
    input: SpeakerInput,
    actor: AuditActor,
  ) => Effect.Effect<Contact, DbError | InvalidInput | NotFound>;
  readonly setWorkflowStatus: (
    eventId: string,
    contactId: string,
    workflowStatus: SpeakerWorkflowStatus,
  ) => Effect.Effect<Contact, DbError | NotFound>;
  readonly center: (eventId: string) => Effect.Effect<typeof CommunicationCenter.Type, DbError>;
  readonly queuePortalInvitations: (
    eventId: string,
    contactIds: ReadonlyArray<string>,
    portalOrigin: string,
  ) => Effect.Effect<ReadonlyArray<PortalInvitationResult>, DbError>;
  readonly saveTemplate: (input: {
    readonly eventId: string;
    readonly id: string | null;
    readonly name: string;
    readonly subjectTemplate: string;
    readonly bodyTemplate: string;
  }) => Effect.Effect<typeof EmailTemplate.Type, DbError | NotFound>;
  readonly deleteTemplate: (eventId: string, id: string) => Effect.Effect<void, DbError>;
  readonly createCampaign: (input: {
    readonly eventId: string;
    readonly templateId: string | null;
    readonly subject: string;
    readonly body: string;
    readonly recipientFilter: Readonly<Record<string, Schema.Json>>;
    readonly contactIds: ReadonlyArray<string>;
    readonly actor: AuditActor;
    readonly portalOrigin: string;
  }) => Effect.Effect<
    { readonly campaignId: string; readonly logIds: ReadonlyArray<string> },
    DbError | InvalidInput | NotFound
  >;
  readonly completeCampaign: (
    campaignId: string,
  ) => Effect.Effect<EmailCampaign, DbError | NotFound>;
  readonly saveReminderRule: (
    eventId: string,
    id: string,
    daysBeforeDue: number,
    enabled: boolean,
  ) => Effect.Effect<typeof ReminderRule.Type, DbError | NotFound>;
  readonly queueReminderRule: (
    eventId: string,
    id: string,
    portalOrigin: string,
    now: Date,
  ) => Effect.Effect<
    { readonly skippedAsDuplicate: boolean; readonly logIds: ReadonlyArray<string> },
    DbError | NotFound
  >;
}

export class SpeakerComms extends Context.Service<SpeakerComms, SpeakerCommsService>()(
  "opensesh/SpeakerComms",
) {}

const speakerName = (contact: { readonly firstName: string; readonly lastName: string }) =>
  `${contact.firstName} ${contact.lastName}`;

const normalizedEmail = (email: string) => email.trim().toLowerCase();

const createdBy = (actor: AuditActor) =>
  actor.kind === "user"
    ? { createdByUserId: actor.userId, createdByApiKeyId: null }
    : { createdByUserId: null, createdByApiKeyId: actor.apiKeyId };

const editActor = (actor: AuditActor) =>
  actor.kind === "user"
    ? {
        authorUserId: actor.userId,
        authorApiKeyId: null,
        reviewedByUserId: actor.userId,
        reviewedByApiKeyId: null,
      }
    : {
        authorUserId: null,
        authorApiKeyId: actor.apiKeyId,
        reviewedByUserId: null,
        reviewedByApiKeyId: actor.apiKeyId,
      };

const profileValues = (input: SpeakerInput) => ({
  email: normalizedEmail(input.email),
  firstName: input.firstName.trim(),
  lastName: input.lastName.trim(),
  title: input.title,
  company: input.company,
  bio: input.bio,
  linkedinUrl: input.linkedinUrl,
  twitterUrl: input.twitterUrl,
  websiteUrl: input.websiteUrl,
  dietaryRequirements: input.dietaryRequirements,
  tshirtSize: input.tshirtSize,
  workflowStatus: input.workflowStatus,
});

export const SpeakerCommsLive = Layer.effect(
  SpeakerComms,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      saveSpeaker: (input, actor) =>
        query(database, "Could not save speaker", (db) =>
          db.transaction(async (transaction) => {
            const values = profileValues(input);
            const duplicate = await transaction
              .select({ id: contacts.id })
              .from(contacts)
              .where(and(eq(contacts.eventId, input.eventId), eq(contacts.email, values.email)))
              .limit(1)
              .execute();
            if (duplicate[0] !== undefined && duplicate[0].id !== input.id)
              return { kind: "duplicate" as const };
            if (input.id === null) {
              const [created] = await transaction
                .insert(contacts)
                .values({
                  eventId: input.eventId,
                  participation: "speaker",
                  ...values,
                  salutation: null,
                  honorific: null,
                  pronouns: null,
                  gender: null,
                  headshotUrl: null,
                  headshotKey: null,
                  phone: null,
                  facebookUrl: null,
                  confirmedAt: null,
                  custom: { travelLogistics: input.travelLogistics ?? "" },
                  approvedProfile: {},
                  profileReviewStatus: "approved",
                })
                .returning()
                .execute();
              return created === undefined
                ? { kind: "notFound" as const }
                : { kind: "ok" as const, row: created };
            }
            const [existing] = await transaction
              .select()
              .from(contacts)
              .where(and(eq(contacts.id, input.id), eq(contacts.eventId, input.eventId)))
              .limit(1)
              .execute();
            if (existing === undefined) return { kind: "notFound" as const };
            const custom = {
              ...existing.custom,
              travelLogistics: input.travelLogistics ?? "",
            };
            const [saved] = await transaction
              .update(contacts)
              .set({
                participation: "speaker",
                ...values,
                custom,
                profileReviewStatus: "approved",
                updatedAt: new Date(),
              })
              .where(and(eq(contacts.id, input.id), eq(contacts.eventId, input.eventId)))
              .returning()
              .execute();
            if (saved === undefined) return { kind: "notFound" as const };
            const changedFields = Object.keys(values).filter(
              (key) =>
                JSON.stringify(existing[key as keyof typeof existing]) !==
                JSON.stringify(saved[key as keyof typeof saved]),
            );
            if (JSON.stringify(existing.custom) !== JSON.stringify(custom))
              changedFields.push("travelLogistics");
            if (changedFields.length > 0)
              await transaction.insert(contactEditHistory).values({
                contactId: existing.id,
                authorContactId: null,
                ...editActor(actor),
                authorName: actor.name,
                changedFields,
                previousValues: {
                  firstName: existing.firstName,
                  lastName: existing.lastName,
                  title: existing.title,
                  company: existing.company,
                  bio: existing.bio,
                  linkedinUrl: existing.linkedinUrl,
                  twitterUrl: existing.twitterUrl,
                  websiteUrl: existing.websiteUrl,
                  travelLogistics:
                    typeof existing.custom.travelLogistics === "string"
                      ? existing.custom.travelLogistics
                      : "",
                },
                newValues: {
                  firstName: saved.firstName,
                  lastName: saved.lastName,
                  title: saved.title,
                  company: saved.company,
                  bio: saved.bio,
                  linkedinUrl: saved.linkedinUrl,
                  twitterUrl: saved.twitterUrl,
                  websiteUrl: saved.websiteUrl,
                  travelLogistics: input.travelLogistics ?? "",
                },
                approvalStatus: "approved",
                reviewedAt: new Date(),
              });
            return { kind: "ok" as const, row: saved };
          }),
        ).pipe(
          Effect.flatMap((outcome): Effect.Effect<Contact, DbError | InvalidInput | NotFound> => {
            if (outcome.kind === "duplicate")
              return Effect.fail(
                new InvalidInput({ message: "A speaker with this email already exists" }),
              );
            if (outcome.kind === "notFound") return decodeFound(Contact, "Speaker", undefined);
            return decode(Contact, "speaker", outcome.row);
          }),
        ),
      setWorkflowStatus: (eventId, contactId, workflowStatus) =>
        query(database, "Could not update speaker workflow", (db) =>
          db
            .update(contacts)
            // Marking a speaker confirmed/ready on their behalf is a real
            // confirmation ("they emailed me") — record the timestamp too.
            // One-way: moving the pipeline back never un-confirms.
            .set({
              workflowStatus,
              ...(workflowStatus === "confirmed" || workflowStatus === "ready"
                ? { confirmedAt: sql`coalesce(${contacts.confirmedAt}, now())` }
                : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(contacts.id, contactId), eq(contacts.eventId, eventId)))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Speaker", rows[0]))),
      center: (eventId) =>
        Effect.gen(function* () {
          const [
            eventRows,
            contactRows,
            assignmentRows,
            participantRows,
            templateRows,
            campaignRows,
            ruleRows,
          ] = yield* Effect.all(
            [
              query(database, "Could not load communication event", (db) =>
                db.select().from(events).where(eq(events.id, eventId)).limit(1).execute(),
              ),
              query(database, "Could not load communication contacts", (db) =>
                db
                  .select({ contact: contacts, submission: submissions })
                  .from(contacts)
                  .leftJoin(
                    submissionParticipants,
                    eq(submissionParticipants.contactId, contacts.id),
                  )
                  .leftJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                  .where(and(eq(contacts.eventId, eventId), eq(contacts.participation, "speaker")))
                  .orderBy(
                    asc(contacts.lastName),
                    asc(contacts.firstName),
                    asc(submissions.createdAt),
                  )
                  .execute(),
              ),
              query(database, "Could not load communication tasks", (db) =>
                db
                  .select({ assignment: taskAssignments, template: taskTemplates })
                  .from(taskAssignments)
                  .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                  .where(eq(taskTemplates.eventId, eventId))
                  .execute(),
              ),
              query(database, "Could not load task participants", (db) =>
                db
                  .select({
                    submissionId: submissionParticipants.submissionId,
                    contactId: submissionParticipants.contactId,
                  })
                  .from(submissionParticipants)
                  .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                  .where(eq(submissions.eventId, eventId))
                  .execute(),
              ),
              query(database, "Could not load email templates", (db) =>
                db
                  .select()
                  .from(emailTemplates)
                  .where(eq(emailTemplates.eventId, eventId))
                  .orderBy(asc(emailTemplates.name))
                  .execute(),
              ),
              query(database, "Could not load campaign history", (db) =>
                db
                  .select({
                    campaign: emailCampaigns,
                    templateName: emailTemplates.name,
                    recipient: emailCampaignRecipients,
                    contact: contacts,
                    emailStatus: emailLog.status,
                  })
                  .from(emailCampaigns)
                  .leftJoin(emailTemplates, eq(emailTemplates.id, emailCampaigns.templateId))
                  .leftJoin(
                    emailCampaignRecipients,
                    eq(emailCampaignRecipients.campaignId, emailCampaigns.id),
                  )
                  .leftJoin(contacts, eq(contacts.id, emailCampaignRecipients.contactId))
                  .leftJoin(emailLog, eq(emailLog.id, emailCampaignRecipients.emailLogId))
                  .where(eq(emailCampaigns.eventId, eventId))
                  .orderBy(desc(emailCampaigns.createdAt), asc(contacts.lastName))
                  .execute(),
              ),
              query(database, "Could not load reminder rules", (db) =>
                db
                  .select()
                  .from(reminderRules)
                  .where(eq(reminderRules.eventId, eventId))
                  .orderBy(asc(reminderRules.createdAt))
                  .execute(),
              ),
            ],
            { concurrency: "unbounded" },
          );
          const event = eventRows[0];
          const uniqueContacts = Array.from(
            new Map(contactRows.map((row) => [row.contact.id, row.contact])).values(),
          );
          const contactTaskStatus = (contactId: string) =>
            assignmentRows.flatMap((row) => {
              const applies =
                row.assignment.contactId === contactId ||
                (row.assignment.submissionId !== null &&
                  participantRows.some(
                    (participant) =>
                      participant.submissionId === row.assignment.submissionId &&
                      participant.contactId === contactId,
                  ));
              return applies ? [row.assignment.status] : [];
            });
          const campaigns = Array.from(
            new Map(campaignRows.map((row) => [row.campaign.id, row.campaign])).values(),
          ).map((campaign) => ({
            campaign,
            templateName:
              campaignRows.find((row) => row.campaign.id === campaign.id)?.templateName ?? null,
            recipients: campaignRows.flatMap((row) =>
              row.campaign.id !== campaign.id || row.recipient === null || row.contact === null
                ? []
                : [
                    {
                      id: row.recipient.id,
                      contactId: row.contact.id,
                      contactName: speakerName(row.contact),
                      email: row.contact.email,
                      resolvedSubject: row.recipient.resolvedSubject,
                      resolvedBody: row.recipient.resolvedBody,
                      deliveryStatus: row.recipient.deliveryStatus,
                      emailLogId: row.recipient.emailLogId,
                      emailStatus: row.emailStatus,
                    },
                  ],
            ),
          }));
          return yield* decode(CommunicationCenter, "communication center", {
            eventName: event?.name ?? "Event",
            eventSlug: event?.slug ?? "event",
            contacts: uniqueContacts.map((contact) => {
              const statuses = contactTaskStatus(contact.id);
              const talkTitle =
                contactRows.find((row) => row.contact.id === contact.id && row.submission !== null)
                  ?.submission?.title ?? "";
              return {
                id: contact.id,
                email: contact.email,
                firstName: contact.firstName,
                lastName: contact.lastName,
                headshotUrl: contact.headshotUrl,
                title: contact.title,
                company: contact.company,
                workflowStatus: contact.workflowStatus,
                taskTotal: statuses.length,
                taskDone: statuses.filter((status) => status !== "todo").length,
                taskIncomplete: statuses.filter((status) => status === "todo").length,
                talkTitle,
              };
            }),
            templates: templateRows,
            campaigns,
            reminderRules: ruleRows,
          });
        }),
      queuePortalInvitations: (eventId, requestedIds, portalOrigin) =>
        query(database, "Could not queue portal invitations", (db) =>
          db.transaction(async (transaction) => {
            const event = await transaction
              .select()
              .from(events)
              .where(eq(events.id, eventId))
              .limit(1)
              .execute();
            const selected =
              requestedIds.length === 0
                ? []
                : await transaction
                    .select()
                    .from(contacts)
                    .where(
                      and(
                        eq(contacts.eventId, eventId),
                        eq(contacts.participation, "speaker"),
                        inArray(contacts.id, requestedIds),
                      ),
                    )
                    .orderBy(asc(contacts.lastName), asc(contacts.firstName))
                    .execute();
            const existing = await transaction
              .select({ contactId: emailLog.contactId })
              .from(emailLog)
              .where(
                and(
                  eq(emailLog.eventId, eventId),
                  eq(emailLog.type, "custom"),
                  eq(emailLog.subject, `Your speaker portal for ${event[0]?.name ?? "this event"}`),
                ),
              )
              .execute();
            const invited = new Set(
              existing.flatMap((row) => (row.contactId === null ? [] : [row.contactId])),
            );
            const results: Array<PortalInvitationResult> = [];
            for (const contact of selected) {
              const portalPath = "/portal";
              if (invited.has(contact.id)) {
                results.push({
                  contactId: contact.id,
                  contactName: speakerName(contact),
                  portalPath,
                  alreadyInvited: true,
                  logId: null,
                });
                continue;
              }
              const subject = `Your speaker portal for ${event[0]?.name ?? "this event"}`;
              const body = `Hi ${contact.firstName},\n\nWelcome to ${event[0]?.name ?? "the event"}. Complete your speaker profile and tasks here: ${portalOrigin}${portalPath}`;
              const [logged] = await transaction
                .insert(emailLog)
                .values({
                  eventId,
                  contactId: contact.id,
                  submissionId: null,
                  type: "custom",
                  recipient: contact.email,
                  subject,
                  body,
                  htmlBody: body.replaceAll("\n", "<br>"),
                  status: "queued",
                  provider: null,
                  providerId: null,
                  error: null,
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute();
              results.push({
                contactId: contact.id,
                contactName: speakerName(contact),
                portalPath,
                alreadyInvited: false,
                logId: logged?.id ?? null,
              });
            }
            return results;
          }),
        ),
      saveTemplate: (input) => {
        const templateId = input.id;
        const values = {
          eventId: input.eventId,
          name: input.name,
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate,
          mergeFields: [
            ...new Set(
              input.subjectTemplate.concat(input.bodyTemplate).match(/\{([^}]+)\}/g) ?? [],
            ),
          ].map((token) => token.slice(1, -1)),
        };
        return templateId === null
          ? query(database, "Could not create email template", (db) =>
              db.insert(emailTemplates).values(values).returning().execute(),
            ).pipe(Effect.flatMap((rows) => decode(EmailTemplate, "email template", rows[0])))
          : query(database, "Could not update email template", (db) =>
              db
                .update(emailTemplates)
                .set({ ...values, updatedAt: new Date() })
                .where(
                  and(eq(emailTemplates.id, templateId), eq(emailTemplates.eventId, input.eventId)),
                )
                .returning()
                .execute(),
            ).pipe(Effect.flatMap((rows) => decodeFound(EmailTemplate, "Email template", rows[0])));
      },
      deleteTemplate: (eventId, id) =>
        query(database, "Could not delete email template", (db) =>
          db
            .delete(emailTemplates)
            .where(and(eq(emailTemplates.id, id), eq(emailTemplates.eventId, eventId)))
            .execute(),
        ).pipe(Effect.asVoid),
      createCampaign: (input) =>
        query(database, "Could not create email campaign", (db) =>
          db.transaction(async (transaction) => {
            const [event] = await transaction
              .select()
              .from(events)
              .where(eq(events.id, input.eventId))
              .limit(1)
              .execute();
            if (event === undefined) return { kind: "notFound" as const };
            const selected =
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
                        eq(contacts.participation, "speaker"),
                        inArray(contacts.id, input.contactIds),
                      ),
                    )
                    .execute();
            if (selected.length === 0) return { kind: "empty" as const };
            const [campaign] = await transaction
              .insert(emailCampaigns)
              .values({
                eventId: input.eventId,
                templateId: input.templateId,
                subjectSnapshot: input.subject,
                bodySnapshot: input.body,
                recipientFilter: input.recipientFilter,
                status: "sending",
                ...createdBy(input.actor),
              })
              .returning()
              .execute();
            if (campaign === undefined) return { kind: "notFound" as const };
            const recipientSources = Array.from(
              new Map(selected.map((row) => [row.contact.id, row.contact])).values(),
            ).map((contact) => ({
              contactId: contact.id,
              speakerName: speakerName(contact),
              talkTitle:
                selected.find((row) => row.contact.id === contact.id && row.submission !== null)
                  ?.submission?.title ?? "",
              email: contact.email,
            }));
            const resolved = buildCampaignRecipientRows({
              campaignId: campaign.id,
              subject: input.subject,
              body: input.body,
              eventName: event.name,
              portalUrl: `${input.portalOrigin}/portal`,
              recipients: recipientSources,
            });
            const recipientRows = await transaction
              .insert(emailCampaignRecipients)
              .values(
                resolved.map((row) => ({
                  ...row,
                  deliveryStatus: "pending" as const,
                })),
              )
              .returning()
              .execute();
            const logIds: Array<string> = [];
            for (const recipient of resolved) {
              const [logged] = await transaction
                .insert(emailLog)
                .values({
                  eventId: input.eventId,
                  contactId: recipient.contactId,
                  submissionId: null,
                  type: "custom",
                  recipient: recipient.recipientEmail,
                  subject: recipient.resolvedSubject,
                  body: recipient.resolvedBody,
                  htmlBody: recipient.resolvedBody.replaceAll("\n", "<br>"),
                  status: "queued",
                  provider: null,
                  providerId: null,
                  error: null,
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute();
              const recipientRow = recipientRows.find(
                (row) => row.contactId === recipient.contactId,
              );
              if (logged !== undefined && recipientRow !== undefined) {
                logIds.push(logged.id);
                await transaction
                  .update(emailCampaignRecipients)
                  .set({ emailLogId: logged.id, updatedAt: new Date() })
                  .where(eq(emailCampaignRecipients.id, recipientRow.id))
                  .execute();
              }
            }
            return { kind: "ok" as const, campaignId: campaign.id, logIds };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              { readonly campaignId: string; readonly logIds: ReadonlyArray<string> },
              DbError | InvalidInput | NotFound
            > =>
              outcome.kind === "notFound"
                ? decodeFound(EmailCampaign, "Campaign", undefined).pipe(
                    Effect.map(() => ({ campaignId: "", logIds: [] })),
                  )
                : outcome.kind === "empty"
                  ? Effect.fail(new InvalidInput({ message: "Choose at least one recipient" }))
                  : Effect.succeed({ campaignId: outcome.campaignId, logIds: outcome.logIds }),
          ),
        ),
      completeCampaign: (campaignId) =>
        query(database, "Could not complete campaign", (db) =>
          db.transaction(async (transaction) => {
            const now = new Date();
            await transaction
              .update(emailCampaignRecipients)
              .set({ deliveryStatus: "sent", updatedAt: now })
              .where(eq(emailCampaignRecipients.campaignId, campaignId))
              .execute();
            const [saved] = await transaction
              .update(emailCampaigns)
              .set({ status: "sent", sentAt: now, updatedAt: now })
              .where(eq(emailCampaigns.id, campaignId))
              .returning()
              .execute();
            return saved;
          }),
        ).pipe(Effect.flatMap((row) => decodeFound(EmailCampaign, "Campaign", row))),
      saveReminderRule: (eventId, id, daysBeforeDue, enabled) =>
        query(database, "Could not save reminder rule", (db) =>
          db
            .update(reminderRules)
            .set({ daysBeforeDue, enabled, updatedAt: new Date() })
            .where(and(eq(reminderRules.id, id), eq(reminderRules.eventId, eventId)))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(ReminderRule, "Reminder rule", rows[0]))),
      queueReminderRule: (eventId, id, portalOrigin, now) =>
        query(database, "Could not run reminder rule", (db) =>
          db.transaction(async (transaction) => {
            const [rule] = await transaction
              .select()
              .from(reminderRules)
              .where(and(eq(reminderRules.id, id), eq(reminderRules.eventId, eventId)))
              .limit(1)
              .execute();
            if (rule === undefined) return { kind: "notFound" as const };
            if (!rule.enabled || reminderAlreadyRanInWindow(rule.lastRunAt, now))
              return { kind: "duplicate" as const };
            const [event, contactRows, assignmentRows, participantRows] = await Promise.all([
              transaction.select().from(events).where(eq(events.id, eventId)).limit(1).execute(),
              transaction
                .select()
                .from(contacts)
                .where(and(eq(contacts.eventId, eventId), eq(contacts.participation, "speaker")))
                .execute(),
              transaction
                .select({ assignment: taskAssignments, template: taskTemplates })
                .from(taskAssignments)
                .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                .where(eq(taskTemplates.eventId, eventId))
                .execute(),
              transaction
                .select({
                  submissionId: submissionParticipants.submissionId,
                  contactId: submissionParticipants.contactId,
                })
                .from(submissionParticipants)
                .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                .where(eq(submissions.eventId, eventId))
                .execute(),
            ]);
            const expanded = assignmentRows.flatMap((row) => {
              const contactIds =
                row.assignment.contactId === null
                  ? participantRows
                      .filter(
                        (participant) => participant.submissionId === row.assignment.submissionId,
                      )
                      .map((participant) => participant.contactId)
                  : [row.assignment.contactId];
              return contactIds.map((contactId) => ({
                assignmentId: row.assignment.id,
                contactId,
                status: row.assignment.status,
                dueDate: row.template.dueDate,
                taskTitle: row.template.title,
              }));
            });
            const eligible = reminderAssignmentsWithinWindow(expanded, now, rule.daysBeforeDue);
            const grouped = new Map<string, Array<(typeof eligible)[number]>>();
            for (const assignment of eligible)
              grouped.set(assignment.contactId, [
                ...(grouped.get(assignment.contactId) ?? []),
                assignment,
              ]);
            const logIds: Array<string> = [];
            for (const [contactId, assignments] of grouped) {
              const contact = contactRows.find((row) => row.id === contactId);
              if (contact === undefined) continue;
              const portalUrl = `${portalOrigin}/portal/tasks`;
              const body = `Hi ${contact.firstName},\n\nThe following speaker tasks are due soon:\n${assignments.map((assignment) => `- ${assignment.taskTitle}`).join("\n")}\n\nComplete them here: ${portalUrl}`;
              const [logged] = await transaction
                .insert(emailLog)
                .values({
                  eventId,
                  contactId,
                  submissionId: null,
                  type: "task_reminder",
                  recipient: contact.email,
                  subject: `Tasks due soon for ${event[0]?.name ?? "your event"}`,
                  body,
                  htmlBody: body.replaceAll("\n", "<br>"),
                  status: "queued",
                  provider: null,
                  providerId: null,
                  error: null,
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute();
              if (logged !== undefined) logIds.push(logged.id);
            }
            await transaction
              .update(reminderRules)
              .set({ lastRunAt: now, updatedAt: now })
              .where(eq(reminderRules.id, id))
              .execute();
            return { kind: "ok" as const, logIds };
          }),
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              { readonly skippedAsDuplicate: boolean; readonly logIds: ReadonlyArray<string> },
              DbError | NotFound
            > =>
              outcome.kind === "notFound"
                ? decodeFound(ReminderRule, "Reminder rule", undefined).pipe(
                    Effect.map(() => ({ skippedAsDuplicate: false, logIds: [] })),
                  )
                : outcome.kind === "duplicate"
                  ? Effect.succeed({ skippedAsDuplicate: true, logIds: [] })
                  : Effect.succeed({ skippedAsDuplicate: false, logIds: outcome.logIds }),
          ),
        ),
    };
  }),
);
