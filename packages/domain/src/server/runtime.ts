import { Effect, Layer, Match } from "effect";

import type {
  DbError,
  Forbidden,
  FormClosed,
  MailError,
  NotFound,
  ScheduleConflict,
  SubmissionLimitReached,
  Unauthenticated,
} from "./errors";

export type AppError =
  | DbError
  | Forbidden
  | FormClosed
  | MailError
  | NotFound
  | ScheduleConflict
  | SubmissionLimitReached
  | Unauthenticated;

export type ServerResult<A> =
  | { readonly ok: true; readonly data: A }
  | { readonly ok: false; readonly error: { readonly status: number; readonly message: string } };

const toServerError = Match.type<AppError>().pipe(
  Match.tag("DbError", (error) => ({ status: 500, message: error.message })),
  Match.tag("NotFound", (error) => ({ status: 404, message: error.message })),
  Match.tag("FormClosed", (error) => ({ status: 409, message: error.message })),
  Match.tag("SubmissionLimitReached", (error) => ({ status: 409, message: error.message })),
  Match.tag("ScheduleConflict", (error) => ({ status: 409, message: error.message })),
  Match.tag("Unauthenticated", (error) => ({ status: 401, message: error.message })),
  Match.tag("Forbidden", (error) => ({ status: 403, message: error.message })),
  Match.tag("MailError", (error) => ({ status: 502, message: error.message })),
  Match.exhaustive,
);

export const run = <A, R>(
  program: Effect.Effect<A, AppError, R>,
  services: Layer.Layer<R, never, never>,
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(services),
      Effect.match({
        onFailure: (error): ServerResult<A> => ({ ok: false, error: toServerError(error) }),
        onSuccess: (data): ServerResult<A> => ({ ok: true, data }),
      }),
    ),
  );
