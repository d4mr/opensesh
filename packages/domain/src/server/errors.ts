import { Data } from "effect";

export class DbError extends Data.TaggedError("DbError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string;
}> {}

export class FormClosed extends Data.TaggedError("FormClosed")<{
  readonly message: string;
}> {}

export class SubmissionLimitReached extends Data.TaggedError("SubmissionLimitReached")<{
  readonly message: string;
}> {}

export class ScheduleConflict extends Data.TaggedError("ScheduleConflict")<{
  readonly message: string;
}> {}
