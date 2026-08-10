import { Effect, Layer, Match } from "effect";

import type {
  AgendaGenerationError,
  AlreadyRecused,
  AlreadyDecided,
  AssignmentCapExceeded,
  BlindDataAccess,
  DbError,
  DropdownValueNotInOptions,
  DuplicateMerge,
  Forbidden,
  FormClosed,
  InvalidInput,
  InvalidPipelineMove,
  MailError,
  NotFound,
  NumericOutOfBounds,
  RoundClosed,
  ScheduleConflict,
  ResourceInUse,
  SubmissionLimitReached,
  Unauthenticated,
} from "./errors";

export type AppError =
  | AgendaGenerationError
  | AlreadyRecused
  | AlreadyDecided
  | AssignmentCapExceeded
  | BlindDataAccess
  | DbError
  | DropdownValueNotInOptions
  | DuplicateMerge
  | Forbidden
  | FormClosed
  | InvalidInput
  | InvalidPipelineMove
  | MailError
  | NotFound
  | NumericOutOfBounds
  | RoundClosed
  | ScheduleConflict
  | ResourceInUse
  | SubmissionLimitReached
  | Unauthenticated;

export type ServerResult<A> =
  | { readonly ok: true; readonly data: A }
  | { readonly ok: false; readonly error: { readonly status: number; readonly message: string } };

const toServerError = Match.type<AppError>().pipe(
  Match.tagsExhaustive({
    AgendaGenerationError: (error) => ({ status: 502, message: error.message }),
    AlreadyDecided: (error) => ({ status: 409, message: error.message }),
    AlreadyRecused: (error) => ({ status: 409, message: error.message }),
    AssignmentCapExceeded: (error) => ({ status: 409, message: error.message }),
    BlindDataAccess: (error) => ({ status: 403, message: error.message }),
    DbError: (error) => ({ status: 500, message: error.message }),
    DropdownValueNotInOptions: (error) => ({ status: 400, message: error.message }),
    DuplicateMerge: (error) => ({ status: 409, message: error.message }),
    NotFound: (error) => ({ status: 404, message: error.message }),
    FormClosed: (error) => ({ status: 409, message: error.message }),
    InvalidInput: (error) => ({ status: 400, message: error.message }),
    InvalidPipelineMove: (error) => ({ status: 409, message: error.message }),
    NumericOutOfBounds: (error) => ({ status: 400, message: error.message }),
    RoundClosed: (error) => ({ status: 409, message: error.message }),
    SubmissionLimitReached: (error) => ({ status: 409, message: error.message }),
    ScheduleConflict: (error) => ({ status: 409, message: error.message }),
    ResourceInUse: (error) => ({ status: 409, message: error.message }),
    Unauthenticated: (error) => ({ status: 401, message: error.message }),
    Forbidden: (error) => ({ status: 403, message: error.message }),
    MailError: (error) => ({ status: 502, message: error.message }),
  }),
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
