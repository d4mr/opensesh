import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { contacts, emailLog, events } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { type DbError, MailError, type NotFound } from "./errors";
import { Event } from "./schema/core";
import { decodeFound, query } from "./repos/shared";

export const OutboundMail = Schema.Struct({
  to: Schema.String,
  subject: Schema.String,
  text: Schema.String,
  html: Schema.String,
});
export type OutboundMail = typeof OutboundMail.Type;

export const MagicLinkMail = Schema.Struct({
  eventSlug: Schema.String,
  email: Schema.String,
  url: Schema.String,
});
export type MagicLinkMail = typeof MagicLinkMail.Type;

export type MailTransport = (mail: OutboundMail) => Effect.Effect<void, MailError>;

interface MailService {
  readonly sendMagicLink: (
    input: MagicLinkMail,
  ) => Effect.Effect<void, DbError | MailError | NotFound>;
}

export class Mail extends Context.Service<Mail, MailService>()("opensesh/Mail") {}

const makeMailLayer = (demoMode: boolean, deliver: MailTransport) =>
  Layer.effect(
    Mail,
    Effect.gen(function* () {
      const { database } = yield* Db;

      return {
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
            const subject = `Sign in to ${event.name}`;
            const body = `Use this secure link to sign in: ${input.url}`;
            const rows = yield* query(database, "Could not record magic link email", (db) =>
              db
                .insert(emailLog)
                .values({
                  eventId: event.id,
                  contactId: contactRows[0]?.id ?? null,
                  type: "magic_link",
                  subject,
                  body,
                  icsAttached: false,
                  status: "queued",
                  sentAt: null,
                })
                .returning({ id: emailLog.id })
                .execute(),
            );
            const logId = rows[0]?.id;

            if (demoMode) {
              return;
            }

            const delivery = deliver({
              to: input.email,
              subject,
              text: body,
              html: `<p>Use this secure link to sign in:</p><p><a href="${input.url}">Sign in to ${event.name}</a></p>`,
            });

            yield* delivery.pipe(
              Effect.catch((error) =>
                Effect.gen(function* () {
                  if (logId !== undefined) {
                    yield* query(database, "Could not mark email failed", (db) =>
                      db
                        .update(emailLog)
                        .set({ status: "failed", updatedAt: new Date() })
                        .where(eq(emailLog.id, logId))
                        .execute(),
                    );
                  }
                  return yield* Effect.fail(error);
                }),
              ),
            );

            if (logId !== undefined) {
              yield* query(database, "Could not mark email sent", (db) =>
                db
                  .update(emailLog)
                  .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
                  .where(eq(emailLog.id, logId))
                  .execute(),
              );
            }
          }),
      };
    }),
  );

export const makeMailLive = (connectionString: string, demoMode: boolean, deliver: MailTransport) =>
  makeMailLayer(demoMode, deliver).pipe(Layer.provide(makeDbLive(connectionString)));

export const sendMagicLink = (input: MagicLinkMail) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    return yield* mail.sendMagicLink(input);
  });
