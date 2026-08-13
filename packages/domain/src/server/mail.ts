import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { DEMO_ORG_ID, deliverableRecipient } from "../demo";
import { emailLog, events } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { type DbError, MailError, type NotFound } from "./errors";
import { magicLink, organizationInvitation } from "./mail/templates";
import { decodeFound, query } from "./repos/shared";
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
  readonly status: "demo" | "sent" | "failed";
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

      const sendLogged = (logId: string, mail: OutboundMail) =>
        Effect.gen(function* () {
          const logOnly = demoMode || !deliverableRecipient(mail.to) || (yield* demoOrgLog(logId));
          yield* updateLog(
            logId,
            {
              status: "queued",
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
