import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { contacts, emailLog, events } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { type DbError, MailError, type NotFound } from "./errors";
import { magicLink, organizationInvitation } from "./mail/templates";
import { decodeFound, query } from "./repos/shared";
import { Event } from "./schema/core";
import { EmailLogEntry, EmailType } from "./schema/portal";

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
  eventSlug: Schema.String,
  email: Schema.String,
  url: Schema.String,
});
export type MagicLinkMail = typeof MagicLinkMail.Type;

export const OrganizationInvitationMail = Schema.Struct({
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
  readonly status: "demo" | "sent" | "failed";
  readonly error: string | null;
}

interface MailService {
  readonly sendMagicLink: (
    input: MagicLinkMail,
  ) => Effect.Effect<MailDeliveryResult, DbError | NotFound>;
  readonly sendOrganizationInvitation: (
    input: OrganizationInvitationMail,
  ) => Effect.Effect<void, MailError>;
  readonly sendDecision: (mail: OutboundMail) => Effect.Effect<void, MailError>;
  readonly sendLogged: (
    logId: string,
    mail: OutboundMail,
  ) => Effect.Effect<MailDeliveryResult, DbError>;
  readonly sendQueued: (logId: string) => Effect.Effect<MailDeliveryResult, DbError | NotFound>;
}

export class Mail extends Context.Service<Mail, MailService>()("opensesh/Mail") {}

const failureMessage = (error: MailError) =>
  error.cause instanceof Error ? error.cause.message : error.message;

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

      const sendLogged = (logId: string, mail: OutboundMail) =>
        Effect.gen(function* () {
          yield* updateLog(
            logId,
            {
              status: "queued",
              provider: demoMode ? "demo" : provider,
              providerId: null,
              error: null,
              sentAt: null,
            },
            "Could not queue email",
          );
          if (demoMode) {
            yield* updateLog(
              logId,
              { status: "demo", provider: "demo", sentAt: new Date() },
              "Could not mark demo email",
            );
            return { id: logId, status: "demo", error: null } as const;
          }
          return yield* deliver(mail).pipe(
            Effect.matchEffect({
              onFailure: (error) => {
                const message = failureMessage(error);
                return updateLog(
                  logId,
                  { status: "failed", provider, error: message, sentAt: null },
                  "Could not mark email failed",
                ).pipe(Effect.as({ id: logId, status: "failed", error: message } as const));
              },
              onSuccess: (result) =>
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
                ).pipe(Effect.as({ id: logId, status: "sent", error: null } as const)),
            }),
          );
        });

      const sendQueued = (logId: string) =>
        query(database, "Could not load queued email", (db) =>
          db.select().from(emailLog).where(eq(emailLog.id, logId)).limit(1).execute(),
        ).pipe(
          Effect.flatMap((rows) => decodeFound(EmailLogEntry, "Email", rows[0])),
          Effect.flatMap((entry) =>
            sendLogged(entry.id, {
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
          const rendered = organizationInvitation(input);
          return demoMode
            ? Effect.void
            : deliver({
                to: input.email,
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html,
              }).pipe(Effect.asVoid);
        },
        sendDecision: (mail) =>
          demoMode ? Effect.succeed(undefined) : deliver(mail).pipe(Effect.asVoid),
        sendLogged,
        sendQueued,
        sendMagicLink: (input) =>
          Effect.gen(function* () {
            const eventRows = yield* query(database, "Could not load email event", (db) =>
              db.select().from(events).where(eq(events.slug, input.eventSlug)).limit(1).execute(),
            );
            const event = yield* decodeFound(Event, "Event", eventRows[0]);
            const contactRows = yield* query(database, "Could not match email contact", (db) =>
              db
                .select({ id: contacts.id })
                .from(contacts)
                .where(and(eq(contacts.eventId, event.id), eq(contacts.email, input.email)))
                .limit(1)
                .execute(),
            );
            const rendered = magicLink({
              eventName: event.name,
              logoUrl: event.logoUrl,
              url: input.url,
            });
            const rows = yield* query(database, "Could not record magic link email", (db) =>
              db
                .insert(emailLog)
                .values({
                  eventId: event.id,
                  contactId: contactRows[0]?.id ?? null,
                  submissionId: null,
                  type: "magic_link" satisfies typeof EmailType.Type,
                  recipient: input.email,
                  subject: rendered.subject,
                  body: rendered.text,
                  htmlBody: rendered.html,
                  icsAttached: false,
                  icsContent: null,
                  icsSequence: null,
                  status: "queued",
                  provider: null,
                  providerId: null,
                  error: null,
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute(),
            );
            const row = rows[0];
            if (row === undefined) {
              return yield* Effect.fail(
                new MailError({ message: "Could not record magic link email", cause: rows }),
              );
            }
            return yield* sendLogged(row.id, {
              to: input.email,
              subject: rendered.subject,
              text: rendered.text,
              html: rendered.html,
            });
          }).pipe(
            Effect.catchTag("MailError", (error) =>
              Effect.succeed({
                id: "unlogged",
                status: "failed",
                error: failureMessage(error),
              } as const),
            ),
          ),
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
