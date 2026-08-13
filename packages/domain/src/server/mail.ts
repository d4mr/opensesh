import { and, count, eq, inArray, lt, or } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { DEMO_ORG_ID, deliverableRecipient } from "../demo";
import { emailCampaignRecipients, emailCampaigns, emailLog, events } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { type DbError, MailError } from "./errors";
import { magicLink, organizationInvitation } from "@opensesh/email";
import { decode, query } from "./repos/shared";
import { EmailLogEntry } from "./schema/portal";

export const MailAttachment = Schema.Struct({
  filename: Schema.String,
  content: Schema.String,
  contentType: Schema.String,
});
export type MailAttachment = typeof MailAttachment.Type;

export const OutboundMail = Schema.Struct({
  to: Schema.String,
  subject: Schema.String,
  text: Schema.String,
  html: Schema.String,
  attachment: Schema.optionalKey(MailAttachment),
});
export type OutboundMail = typeof OutboundMail.Type;

export const MagicLinkMail = Schema.Struct({
  email: Schema.String,
  url: Schema.String,
});
export type MagicLinkMail = typeof MagicLinkMail.Type;

export const OrganizationInvitationMail = Schema.Struct({
  organizationId: Schema.String,
  organizationName: Schema.String,
  inviterName: Schema.String,
  email: Schema.String,
  role: Schema.String,
  url: Schema.String,
});
export type OrganizationInvitationMail = typeof OrganizationInvitationMail.Type;

export interface TransportResult {
  readonly providerId: string | null;
}

export type MailTransport = (mail: OutboundMail) => Effect.Effect<TransportResult, MailError>;

export interface MailDeliveryResult {
  readonly id: string;
  readonly status: "queued" | "demo" | "sent" | "failed" | "skipped";
  readonly error: string | null;
}

interface MailService {
  readonly sendMagicLink: (input: MagicLinkMail) => Effect.Effect<MailDeliveryResult>;
  readonly sendOrganizationInvitation: (
    input: OrganizationInvitationMail,
  ) => Effect.Effect<void, MailError>;
  readonly sendLogged: (
    logId: string,
    mail: OutboundMail,
  ) => Effect.Effect<MailDeliveryResult, DbError>;
  readonly sendQueued: (logId: string) => Effect.Effect<MailDeliveryResult, DbError>;
  readonly releaseQueued: (logId: string) => Effect.Effect<void, DbError>;
  readonly requeueFailed: (logId: string) => Effect.Effect<void, DbError>;
  readonly failQueued: (logId: string, error: string) => Effect.Effect<void, DbError>;
  readonly sweepStale: (before: Date) => Effect.Effect<ReadonlyArray<string>, DbError>;
}

export class Mail extends Context.Service<Mail, MailService>()("opensesh/Mail") {}

const failureMessage = (error: MailError) =>
  error.cause instanceof Error ? error.cause.message : error.message;

export const mailFailureStatus = (error: Pick<MailError, "transient">) =>
  error.transient ? ("queued" as const) : ("failed" as const);

export const planMailSweep = (
  rows: ReadonlyArray<{
    readonly id: string;
    readonly status: "queued" | "sending";
    readonly updatedAt: Date;
  }>,
  before: Date,
) => {
  const stale = rows.filter((row) => row.updatedAt < before);
  return {
    resetIds: stale.filter((row) => row.status === "sending").map((row) => row.id),
    enqueueIds: stale.map((row) => row.id),
  };
};

const makeMailLayer = (
  demoMode: boolean,
  provider: "cloudflare" | "resend",
  deliver: MailTransport,
) =>
  Layer.effect(
    Mail,
    Effect.gen(function* () {
      const { database } = yield* Db;

      const updateLog = (
        id: string,
        values: Partial<typeof emailLog.$inferInsert>,
        message: string,
      ) =>
        query(database, message, (db) =>
          db
            .update(emailLog)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(emailLog.id, id))
            .execute(),
        ).pipe(Effect.asVoid);

      // Whether a logged email belongs to the demo workspace. The demo org is
      // a public sandbox with fictional contacts, so its outbound mail is
      // recorded but never delivered.
      const demoOrgLog = (logId: string) =>
        query(database, "Could not resolve email workspace", (db) =>
          db
            .select({ organizationId: events.organizationId })
            .from(emailLog)
            .innerJoin(events, eq(emailLog.eventId, events.id))
            .where(eq(emailLog.id, logId))
            .limit(1)
            .execute(),
        ).pipe(Effect.map((rows) => rows[0]?.organizationId === DEMO_ORG_ID));

      const updateCampaignDelivery = (logId: string, deliveryStatus: "sent" | "failed") =>
        query(database, "Could not update campaign delivery", (db) =>
          db.transaction(async (transaction) => {
            const recipients = await transaction
              .update(emailCampaignRecipients)
              .set({ deliveryStatus, updatedAt: new Date() })
              .where(eq(emailCampaignRecipients.emailLogId, logId))
              .returning({ campaignId: emailCampaignRecipients.campaignId })
              .execute();
            const campaignId = recipients[0]?.campaignId;
            if (campaignId === undefined) return;
            const [pending] = await transaction
              .select({ value: count() })
              .from(emailCampaignRecipients)
              .where(
                and(
                  eq(emailCampaignRecipients.campaignId, campaignId),
                  eq(emailCampaignRecipients.deliveryStatus, "pending"),
                ),
              )
              .execute();
            if ((pending?.value ?? 0) > 0) return;
            const now = new Date();
            await transaction
              .update(emailCampaigns)
              .set({ status: "sent", sentAt: now, updatedAt: now })
              .where(eq(emailCampaigns.id, campaignId))
              .execute();
          }),
        ).pipe(Effect.asVoid);

      const sendLogged = (
        logId: string,
        mail: OutboundMail,
      ): Effect.Effect<MailDeliveryResult, DbError> =>
        Effect.gen(function* () {
          const logOnly = demoMode || !deliverableRecipient(mail.to) || (yield* demoOrgLog(logId));
          yield* updateLog(
            logId,
            {
              provider: logOnly ? "demo" : provider,
              providerId: null,
              error: null,
              sentAt: null,
            },
            "Could not queue email",
          );
          if (logOnly) {
            yield* updateLog(
              logId,
              { status: "demo", provider: "demo", sentAt: new Date() },
              "Could not mark demo email",
            );
            yield* updateCampaignDelivery(logId, "sent");
            return { id: logId, status: "demo", error: null } as const;
          }
          return yield* deliver(mail).pipe(
            Effect.matchEffect({
              onFailure: (error): Effect.Effect<MailDeliveryResult, DbError> => {
                const message = failureMessage(error);
                if (mailFailureStatus(error) === "queued") {
                  return updateLog(
                    logId,
                    { status: "queued", provider, error: message, sentAt: null },
                    "Could not requeue rate-limited email",
                  ).pipe(Effect.as({ id: logId, status: "queued", error: message } as const));
                }
                return updateLog(
                  logId,
                  { status: "failed", provider, error: message, sentAt: null },
                  "Could not mark email failed",
                ).pipe(
                  Effect.andThen(updateCampaignDelivery(logId, "failed")),
                  Effect.as({ id: logId, status: "failed", error: message } as const),
                );
              },
              onSuccess: (result): Effect.Effect<MailDeliveryResult, DbError> =>
                updateLog(
                  logId,
                  {
                    status: "sent",
                    provider,
                    providerId: result.providerId,
                    error: null,
                    sentAt: new Date(),
                  },
                  "Could not mark email sent",
                ).pipe(
                  Effect.andThen(updateCampaignDelivery(logId, "sent")),
                  Effect.as({ id: logId, status: "sent", error: null } as const),
                ),
            }),
          );
        });

      const sendQueued = (logId: string): Effect.Effect<MailDeliveryResult, DbError> =>
        query(database, "Could not claim queued email", (db) =>
          db
            .update(emailLog)
            .set({ status: "sending", updatedAt: new Date() })
            .where(and(eq(emailLog.id, logId), eq(emailLog.status, "queued")))
            .returning()
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined ? Effect.succeed(null) : decode(EmailLogEntry, "Email", rows[0]),
          ),
          Effect.flatMap((entry) =>
            entry === null
              ? Effect.succeed({ id: logId, status: "skipped", error: null } as const)
              : sendLogged(entry.id, {
                  to: entry.recipient,
                  subject: entry.subject,
                  text: entry.body,
                  html: entry.htmlBody,
                  ...(entry.icsContent === null
                    ? {}
                    : {
                        attachment: {
                          filename: `${entry.submissionId ?? "session"}.ics`,
                          content: entry.icsContent,
                          contentType: "text/calendar; method=REQUEST; charset=UTF-8",
                        },
                      }),
                }),
          ),
        );

      return {
        sendOrganizationInvitation: (input) => {
          if (
            demoMode ||
            input.organizationId === DEMO_ORG_ID ||
            !deliverableRecipient(input.email)
          ) {
            return Effect.void;
          }
          const rendered = organizationInvitation(input);
          return deliver({
            to: input.email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
          }).pipe(Effect.asVoid);
        },
        sendLogged,
        sendQueued,
        releaseQueued: (logId) =>
          query(database, "Could not release queued email", (db) =>
            db
              .update(emailLog)
              .set({ status: "queued", updatedAt: new Date() })
              .where(and(eq(emailLog.id, logId), eq(emailLog.status, "sending")))
              .execute(),
          ).pipe(Effect.asVoid),
        requeueFailed: (logId) =>
          query(database, "Could not requeue failed email", (db) =>
            db.transaction(async (transaction) => {
              const now = new Date();
              await transaction
                .update(emailLog)
                .set({ status: "queued", error: null, sentAt: null, updatedAt: now })
                .where(and(eq(emailLog.id, logId), eq(emailLog.status, "failed")))
                .execute();
              const recipients = await transaction
                .update(emailCampaignRecipients)
                .set({ deliveryStatus: "pending", updatedAt: now })
                .where(eq(emailCampaignRecipients.emailLogId, logId))
                .returning({ campaignId: emailCampaignRecipients.campaignId })
                .execute();
              const campaignId = recipients[0]?.campaignId;
              if (campaignId !== undefined) {
                await transaction
                  .update(emailCampaigns)
                  .set({ status: "sending", sentAt: null, updatedAt: now })
                  .where(eq(emailCampaigns.id, campaignId))
                  .execute();
              }
            }),
          ).pipe(Effect.asVoid),
        failQueued: (logId, error) =>
          updateLog(
            logId,
            { status: "failed", error, sentAt: null },
            "Could not mark exhausted email failed",
          ).pipe(Effect.andThen(updateCampaignDelivery(logId, "failed"))),
        sweepStale: (before) =>
          query(database, "Could not sweep stale email", (db) =>
            db.transaction(async (transaction) => {
              const candidates = await transaction
                .select({ id: emailLog.id, status: emailLog.status, updatedAt: emailLog.updatedAt })
                .from(emailLog)
                .where(
                  and(
                    or(eq(emailLog.status, "queued"), eq(emailLog.status, "sending")),
                    lt(emailLog.updatedAt, before),
                  ),
                )
                .for("update", { skipLocked: true })
                .execute();
              const sweepRows: Array<{
                readonly id: string;
                readonly status: "queued" | "sending";
                readonly updatedAt: Date;
              }> = [];
              for (const row of candidates) {
                if (row.status === "queued") {
                  sweepRows.push({ id: row.id, status: "queued", updatedAt: row.updatedAt });
                } else if (row.status === "sending") {
                  sweepRows.push({ id: row.id, status: "sending", updatedAt: row.updatedAt });
                }
              }
              const plan = planMailSweep(sweepRows, before);
              if (plan.resetIds.length > 0) {
                await transaction
                  .update(emailLog)
                  .set({ status: "queued", updatedAt: new Date() })
                  .where(inArray(emailLog.id, plan.resetIds))
                  .execute();
              }
              return plan.enqueueIds;
            }),
          ),
        // Auth-plane mail: the sign-in link is a bearer credential, so it is
        // never written to the event email log the admin viewer can read —
        // delivery to the recipient's inbox is the only copy.
        sendMagicLink: (input) => {
          if (demoMode || !deliverableRecipient(input.email)) {
            return Effect.succeed({ id: "magic-link", status: "demo", error: null } as const);
          }
          const rendered = magicLink({ url: input.url });
          return deliver({
            to: input.email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
          }).pipe(
            Effect.map(() => ({ id: "magic-link", status: "sent", error: null }) as const),
            Effect.catchTag("MailError", (error) =>
              Effect.succeed({
                id: "magic-link",
                status: "failed",
                error: failureMessage(error),
              } as const),
            ),
          );
        },
      };
    }),
  );

export const makeMailLive = (
  connectionString: string,
  demoMode: boolean,
  deliver: MailTransport,
  provider: "cloudflare" | "resend" = "cloudflare",
) => makeMailLayer(demoMode, provider, deliver).pipe(Layer.provide(makeDbLive(connectionString)));

export const sendMagicLink = (input: MagicLinkMail) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    return yield* mail.sendMagicLink(input);
  });

export const sendOrganizationInvitation = (input: OrganizationInvitationMail) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    return yield* mail.sendOrganizationInvitation(input);
  });
