import {
  listCfpSubmissions,
  loadCfpDraft,
  loadCfpForm,
  saveCfpDraft,
  submitCfpDraft,
} from "@opensesh/domain/server/cfp";
import { DbError, Unauthenticated } from "@opensesh/domain/server/errors";
import { Mail } from "@opensesh/domain/server/mail";
import {
  CfpClientDraftInput,
  CfpClientSubmitInput,
  PublicDraftRequest,
  PublicFormRequest,
} from "@opensesh/domain/server/schema/forms";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { makeAuth } from "@/lib/auth";
import { runServer } from "@/server/runtime";

const sessionEmail = Effect.fn("publicSessionEmail")(function* () {
  const { env } = yield* Effect.promise(() => import("cloudflare:workers"));
  const request = getRequest();
  const auth = makeAuth(env, new URL(request.url).origin);
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: request.headers }),
    catch: (cause) => new DbError({ message: "Could not load session", cause }),
  });
  return session?.user.email ?? null;
});

export const getPublicForm = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PublicFormRequest))
  .handler(async ({ data }) => runServer(loadCfpForm(data.eventSlug, data.formId)));

export const getPublicFormAccount = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PublicFormRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const email = yield* sessionEmail();
        if (email === null) return { email: null, submissions: [] };
        const submissions = yield* listCfpSubmissions(data.eventSlug, data.formId, email);
        return { email, submissions };
      }),
    ),
  );

export const savePublicDraft = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CfpClientDraftInput))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const email = yield* sessionEmail();
        if (email === null) {
          return yield* Effect.fail(new Unauthenticated({ message: "Sign in to save a draft" }));
        }
        return yield* saveCfpDraft({ ...data, email });
      }),
    ),
  );

export const submitPublicDraft = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CfpClientSubmitInput))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const email = yield* sessionEmail();
        if (email === null) {
          return yield* Effect.fail(new Unauthenticated({ message: "Sign in to submit" }));
        }
        const request = getRequest();
        const submitted = yield* submitCfpDraft({
          ...data,
          email,
          portalOrigin: new URL(request.url).origin,
        });
        if (submitted.confirmationLogId !== null) {
          const mail = yield* Mail;
          yield* mail.sendQueued(submitted.confirmationLogId);
        }
        return { submission: submitted.submission, form: submitted.form };
      }),
    ),
  );

export const getPublicDraft = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PublicDraftRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const email = yield* sessionEmail();
        if (email === null) {
          return yield* Effect.fail(new Unauthenticated({ message: "Sign in to continue" }));
        }
        return yield* loadCfpDraft(data.eventSlug, data.formId, data.submissionId, email);
      }),
    ),
  );
