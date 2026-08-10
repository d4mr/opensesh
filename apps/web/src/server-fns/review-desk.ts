import {
  CsvExportRequest,
  DecisionRequest,
  ReviewDeskDetailRequest,
  ReviewDeskListRequest,
  ReviewUpsertRequest,
  StatusChangeRequest,
  type CsvColumn,
  type ReviewDeskListItem,
} from "@opensesh/domain";
import { Mail } from "@opensesh/domain/server/mail";
import { ReviewDesk } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer, runSessionServer } from "@/server/runtime";

export const getReviewDeskList = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ReviewDeskListRequest))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.list(session, eventSlug, data.eventId, data.kind);
      }),
    ),
  );

export const getReviewDeskDetail = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ReviewDeskDetailRequest))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.detail(session, eventSlug, data.eventId, data.submissionId);
      }),
    ),
  );

export const getEvaluationQueue = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.evaluationQueue(session, eventSlug, data.eventId);
      }),
    ),
  );

export const saveReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReviewUpsertRequest))
  .handler(async ({ data }) =>
    runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.upsertReview(session, eventSlug, data);
      }),
    ),
  );

export const changeSubmissionStatus = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(StatusChangeRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.changeStatus(
          "ai-engineer-nyc-2026",
          data.eventId,
          data.submissionId,
          data.status,
        );
      }),
      { require: "admin" },
    ),
  );

export const decideSubmissions = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(DecisionRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        const mail = yield* Mail;
        const decision = yield* reviewDesk.decide("ai-engineer-nyc-2026", data);
        yield* Effect.forEach(
          decision.deliveries,
          (delivery) => mail.sendLogged(delivery.logId, delivery.mail),
          { concurrency: 5 },
        );
        return decision.result;
      }),
      { require: "admin" },
    ),
  );

const csvHeaders: Readonly<Record<CsvColumn, string>> = {
  status: "Status",
  code: "Code",
  title: "Title",
  tracks: "Tracks",
  format: "Format",
  speakers: "Speakers",
  rating: "Rating",
  reviews: "Reviews",
  source: "Source",
  submitted: "Submitted",
  notified: "Notified",
};

const csvValue = (submission: ReviewDeskListItem, column: CsvColumn) => {
  if (column === "tracks") return submission.tracks.map((track) => track.name).join("; ");
  if (column === "speakers") return submission.speakers.map((speaker) => speaker.name).join("; ");
  if (column === "rating") return submission.rating?.toFixed(1) ?? "";
  if (column === "reviews") return String(submission.reviewCount);
  if (column === "submitted") return submission.submittedAt?.toISOString() ?? "";
  if (column === "notified") return submission.notifiedAt?.toISOString() ?? "";
  return submission[column] ?? "";
};

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const exportSubmissionsCsv = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(CsvExportRequest))
  .handler(async ({ data }) => {
    const result = await runSessionServer((session, eventSlug) =>
      Effect.gen(function* () {
        const reviewDesk = yield* ReviewDesk;
        const list = yield* reviewDesk.list(session, eventSlug, data.eventId, data.kind);
        const included = new Set(data.submissionIds);
        const rows = list.submissions.filter((submission) => included.has(submission.id));
        return [
          data.columns.map((column) => csvCell(csvHeaders[column])).join(","),
          ...rows.map((submission) =>
            data.columns.map((column) => csvCell(String(csvValue(submission, column)))).join(","),
          ),
        ].join("\r\n");
      }),
    );
    if (!result.ok) {
      return new Response(result.error.message, { status: result.error.status });
    }
    const bytes = new TextEncoder().encode(result.data);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Disposition": `attachment; filename="${data.kind}s.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  });
