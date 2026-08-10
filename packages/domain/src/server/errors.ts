import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string;
}> {}
