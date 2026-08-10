import { MailError } from "@opensesh/domain/server/errors";
import { type MailTransport, makeMailLive } from "@opensesh/domain/server/mail";
import { Effect, Schema } from "effect";

type MailEnv = Cloudflare.Env & {
  readonly MAIL_PROVIDER?: string;
  readonly RESEND_API_KEY?: string;
};

const connectionString = (env: MailEnv) => env.HYPERDRIVE.connectionString;

const cloudflareTransport =
  (env: MailEnv): MailTransport =>
  (mail) =>
    Effect.tryPromise({
      try: () =>
        env.EMAIL.send({
          to: mail.to,
          from: { email: env.MAIL_FROM, name: "opensesh" },
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          ...(mail.attachment === undefined
            ? {}
            : {
                attachments: [
                  {
                    content: mail.attachment.content,
                    filename: mail.attachment.filename,
                    type: mail.attachment.contentType,
                    disposition: "attachment" as const,
                  },
                ],
              }),
        }),
      catch: (cause) => new MailError({ message: "Cloudflare could not send email", cause }),
    }).pipe(Effect.map((response) => ({ providerId: response.messageId ?? null })));

const base64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const ResendResponse = Schema.Struct({ id: Schema.String });

const resendTransport =
  (env: MailEnv): MailTransport =>
  (mail) => {
    const key = env.RESEND_API_KEY;
    if (key === undefined || key.length === 0) {
      return Effect.fail(
        new MailError({ message: "Resend is not configured", cause: "RESEND_API_KEY is missing" }),
      );
    }
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.MAIL_FROM,
            to: [mail.to],
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            ...(mail.attachment === undefined
              ? {}
              : {
                  attachments: [
                    {
                      content: base64(mail.attachment.content),
                      filename: mail.attachment.filename,
                    },
                  ],
                }),
          }),
        });
        const body: unknown = await response.json();
        return { ok: response.ok, status: response.status, body };
      },
      catch: (cause) => new MailError({ message: "Resend could not send email", cause }),
    }).pipe(
      Effect.flatMap((response) =>
        response.ok
          ? Schema.decodeUnknownEffect(ResendResponse)(response.body).pipe(
              Effect.mapError(
                (cause) => new MailError({ message: "Resend returned an invalid response", cause }),
              ),
            )
          : Effect.fail(
              new MailError({
                message: `Resend rejected email (${response.status})`,
                cause: response.body,
              }),
            ),
      ),
      Effect.map((response) => ({ providerId: response.id })),
    );
  };

const demoTransport: MailTransport = () => Effect.succeed({ providerId: null });

export const CloudflareMailLive = (env: MailEnv) =>
  makeMailLive(connectionString(env), false, cloudflareTransport(env), "cloudflare");

export const ResendLive = (env: MailEnv) =>
  makeMailLive(connectionString(env), false, resendTransport(env), "resend");

export const DemoLive = (env: MailEnv) =>
  makeMailLive(connectionString(env), true, demoTransport, "cloudflare");

export const mailLayerFromEnv = (env: MailEnv) => {
  if (env.DEMO_MODE === "1" || env.MAIL_PROVIDER === "demo") return DemoLive(env);
  return env.MAIL_PROVIDER === "resend" ? ResendLive(env) : CloudflareMailLive(env);
};
