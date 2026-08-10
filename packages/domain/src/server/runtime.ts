import { Effect, Layer, Match } from "effect";

import type {
  AgendaGenerationError,
  AlreadyDecided,
  DbError,
  Forbidden,
  FormClosed,
  InvalidInput,
  MailError,
  NotFound,
  ScheduleConflict,
  ResourceInUse,
  SubmissionLimitReached,
  Unauthenticated,
} from "./errors";

export type AppError =
  | AgendaGenerationError
  | AlreadyDecided
  | DbError
  | Forbidden
  | FormClosed
  | InvalidInput
  | MailError
  | NotFound
  | ScheduleConflict
  | ResourceInUse
  | SubmissionLimitReached
  | Unauthenticated;

export type ServerResult<A> =
  | { readonly ok: true; readonly data: A }
  | { readonly ok: false; readonly error: { readonly status: number; readonly message: string } };

const toServerError = Match.type<AppError>().pipe(
  Match.tag("AgendaGenerationError", (error) => ({ status: 502, message: error.message })),
  Match.tag("AlreadyDecided", (error) => ({ status: 409, message: error.message })),
  Match.tag("DbError", (error) => ({ status: 500, message: error.message })),
  Match.tag("NotFound", (error) => ({ status: 404, message: error.message })),
  Match.tag("FormClosed", (error) => ({ status: 409, message: error.message })),
  Match.tag("InvalidInput", (error) => ({ status: 400, message: error.message })),
  Match.tag("SubmissionLimitReached", (error) => ({ status: 409, message: error.message })),
  Match.tag("ScheduleConflict", (error) => ({ status: 409, message: error.message })),
  Match.tag("ResourceInUse", (error) => ({ status: 409, message: error.message })),
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
