import {
  CsvExportRequest,
  DecisionRequest,
  InformRequest,
  ManualSessionCreateRequest,
  ReviewDeskDetailRequest,
  ReviewDeskListRequest,
  ReviewUpsertRequest,
  StatusChangeRequest,
  type CsvColumn,
  type ReviewDeskListItem,
} from "@opensesh/domain";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Forbidden, InvalidInput } from "@opensesh/domain/server/errors";
import { Contacts, Events, Portal, ReviewDesk, Submissions } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";
import { MailQueue } from "@/server/mail-queue";

export const getReviewDeskList = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ReviewDeskListRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.list(data.eventId);
      }),
      { require: "staff" },
    ),
  );

export const getReviewDeskDetail = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ReviewDeskDetailRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.detail(data.eventId, data.submissionId);
      }),
      { require: "staff" },
    ),
  );

export const saveReview = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReviewUpsertRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "reviewer");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.upsertReview(
          { userId: access.user.userId, isAdmin: access.admin },
          data,
        );
      }),
      { require: "staff" },
    ),
  );

export const changeSubmissionStatus = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(StatusChangeRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        return yield* reviewDesk.changeStatus(data.eventId, data.submissionId, data.status, {
          kind: "user",
          userId: access.user.userId,
          name: access.user.name,
        });
      }),
      { require: "staff" },
    ),
  );

export const createManualSession = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ManualSessionCreateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const title = data.title.trim();
        const speakerIds = Array.from(new Set(data.speakerIds));
        if (title.length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Enter a session title" }));
        }
        if (speakerIds.length === 0) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Every session must have a speaker" }),
          );
        }

        const contacts = yield* Contacts;
        const events = yield* Events;
        const [eventContacts, eventFormats, eventTracks] = yield* Effect.all([
          contacts.listByEvent(data.eventId),
          events.listFormats(data.eventId),
          events.listTracks(data.eventId),
        ]);
        const availableContactIds = new Set(eventContacts.map((contact) => contact.id));
        if (speakerIds.some((id) => !availableContactIds.has(id))) {
          return yield* Effect.fail(
            new Forbidden({ message: "One or more speakers do not belong to this event" }),
          );
        }
        if (data.formatId !== null && !eventFormats.some((format) => format.id === data.formatId)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Choose a format from this event" }),
          );
        }
        if (data.trackId !== null && !eventTracks.some((track) => track.id === data.trackId)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Choose a track from this event" }),
          );
        }

        const submissions = yield* Submissions;
        const created = yield* submissions.create({
          eventId: data.eventId,
          status: "accepted",
          sourceFormId: null,
          submitterContactId: null,
          title,
          description: data.description,
          formatId: data.formatId,
          levelId: null,
          language: "en",
          startsAt: null,
          endsAt: null,
          roomId: null,
          icsSequence: 0,
          scheduleDirty: false,
          capacity: null,
          ceuCredits: null,
          clientSessionId: null,
          notifiedAt: null,
          submittedAt: new Date(),
          answers: {},
          approvedSnapshot: {},
          contentReviewStatus: "pending_review",
          cancelledAt: null,
          cancelledBy: null,
        });
        yield* submissions.replaceParticipants(
          created.id,
          speakerIds.map((contactId, position) => ({ contactId, role: "speaker", position })),
        );
        yield* submissions.replaceTrackIds(created.id, data.trackId === null ? [] : [data.trackId]);

        // Directly-created accepted sessions skip the review decision transaction.
        // Reuse the portal acceptance path to snapshot public content and create
        // every auto-on-accept contact and submission task assignment.
        const portal = yield* Portal;
        return yield* portal.acceptSubmission(data.eventId, created.id);
      }),
      { require: "staff" },
    ),
  );

export const decideSubmissions = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(DecisionRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        const decision = yield* reviewDesk.decide({
          ...data,
          actor: { kind: "user", userId: access.user.userId, name: access.user.name },
        });
        return decision.result;
      }),
      { require: "staff" },
    ),
  );

export const informSubmissions = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(InformRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        const informed = yield* reviewDesk.inform({
          eventId: data.eventId,
          submissionIds: data.submissionIds,
          feedback: data.feedback ?? "",
          portalOrigin: new URL(getRequest().url).origin,
          actor: { kind: "user", userId: access.user.userId, name: access.user.name },
        });
        const queue = yield* MailQueue;
        yield* queue.enqueue(informed.logIds);
        return informed.result;
      }),
      { require: "staff" },
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
    const result = await runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const reviewDesk = yield* ReviewDesk;
        const list = yield* reviewDesk.list(data.eventId);
        const included = new Set(data.submissionIds);
        const rows = list.submissions.filter((submission) => included.has(submission.id));
        return [
          data.columns.map((column) => csvCell(csvHeaders[column])).join(","),
          ...rows.map((submission) =>
            data.columns.map((column) => csvCell(String(csvValue(submission, column)))).join(","),
          ),
        ].join("\r\n");
      }),
      { require: "staff" },
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
        "Content-Disposition": 'attachment; filename="submissions.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  });
