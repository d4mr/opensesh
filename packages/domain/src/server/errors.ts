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

export class ResourceInUse extends Data.TaggedError("ResourceInUse")<{
  readonly message: string;
}> {}

export class InvalidInput extends Data.TaggedError("InvalidInput")<{
  readonly message: string;
}> {}

export class ScheduleConflict extends Data.TaggedError("ScheduleConflict")<{
  readonly message: string;
}> {}

export class AgendaGenerationError extends Data.TaggedError("AgendaGenerationError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ReviewGenerationError extends Data.TaggedError("ReviewGenerationError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class AlreadyDecided extends Data.TaggedError("AlreadyDecided")<{
  readonly message: string;
}> {}

export class Unauthenticated extends Data.TaggedError("Unauthenticated")<{
  readonly message: string;
}> {}

export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly message: string;
}> {}

export class MailError extends Data.TaggedError("MailError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class RoundClosed extends Data.TaggedError("RoundClosed")<{
  readonly message: string;
}> {}

export class AssignmentCapExceeded extends Data.TaggedError("AssignmentCapExceeded")<{
  readonly message: string;
}> {}

export class AlreadyRecused extends Data.TaggedError("AlreadyRecused")<{
  readonly message: string;
}> {}

export class NumericOutOfBounds extends Data.TaggedError("NumericOutOfBounds")<{
  readonly message: string;
}> {}

export class DropdownValueNotInOptions extends Data.TaggedError("DropdownValueNotInOptions")<{
  readonly message: string;
}> {}

export class BlindDataAccess extends Data.TaggedError("BlindDataAccess")<{
  readonly message: string;
}> {}

export class DuplicateMerge extends Data.TaggedError("DuplicateMerge")<{
  readonly message: string;
}> {}

export class InvalidPipelineMove extends Data.TaggedError("InvalidPipelineMove")<{
  readonly message: string;
}> {}
