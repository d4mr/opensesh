import { Effect } from "effect";

import type { SessionIdentity } from "../server/current-user";
import { InvalidInput } from "../server/errors";
import { Events, ReviewDesk, Tasks, makeRepositoriesLive } from "../server/repos";
import { run } from "../server/runtime";

const eventId = "evt_aie_nyc_2026";
const eventSlug = "ai-engineer-nyc-2026";
const feedback = "Strong architecture and unusually concrete production lessons.";

const rey: SessionIdentity = {
  userId: "usr_rey",
  email: "rey@demo.opensesh.io",
  name: "Rey Reviewer",
  activeOrganizationId: "org_ai_engineer",
};
const reyViewer = { userId: rey.userId, isAdmin: false };

const verify = Effect.gen(function* () {
  const reviewDesk = yield* ReviewDesk;
  const tasks = yield* Tasks;
  const events = yield* Events;
  const reviewerEvents = yield* events.listForAdmin(rey, eventSlug);
  const initialQueue = yield* reviewDesk.evaluationQueue(reyViewer, eventId);
  const reviewTarget = initialQueue.items.find((item) => item.myReview === null);
  const acceptTarget = initialQueue.items.find((item) => item.submission.code === "SESS-2");
  if (reviewTarget === undefined || acceptTarget === undefined) {
    return yield* Effect.fail(
      new InvalidInput({ message: "Review desk verification fixtures are incomplete" }),
    );
  }

  const savedReview = yield* reviewDesk.upsertReview(reyViewer, {
    eventId,
    submissionId: reviewTarget.submission.id,
    decision: "approve",
    score: 5,
    comment: feedback,
  });
  const reviewedQueue = yield* reviewDesk.evaluationQueue(reyViewer, eventId);
  const firstDecision = yield* reviewDesk.decide({
    eventId,
    submissionIds: [acceptTarget.submission.id],
    decision: "accept",
    confirmRedecide: false,
    approveContent: true,
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });
  yield* reviewDesk.inform({
    eventId,
    submissionIds: [acceptTarget.submission.id],
    feedback,
    portalOrigin: "https://app.opensesh.io",
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });

  const acceptedDetail = yield* reviewDesk.detail(eventId, acceptTarget.submission.id);
  const taskGroups = yield* Effect.all(
    [
      ...acceptedDetail.submission.speakers.map((speaker) =>
        tasks.listAssignmentsByContact(speaker.id),
      ),
      tasks.listAssignmentsBySubmission(acceptTarget.submission.id),
    ],
    { concurrency: 5 },
  );
  const taskCount = taskGroups.reduce((total, assignments) => total + assignments.length, 0);

  const retry = yield* reviewDesk.decide({
    eventId,
    submissionIds: [acceptTarget.submission.id],
    decision: "accept",
    confirmRedecide: false,
    approveContent: true,
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });
  const taskGroupsAfterRetry = yield* Effect.all(
    [
      ...acceptedDetail.submission.speakers.map((speaker) =>
        tasks.listAssignmentsByContact(speaker.id),
      ),
      tasks.listAssignmentsBySubmission(acceptTarget.submission.id),
    ],
    { concurrency: 5 },
  );
  const taskCountAfterRetry = taskGroupsAfterRetry.reduce(
    (total, assignments) => total + assignments.length,
    0,
  );

  const abstracts = yield* reviewDesk.list(eventId);
  const undoTarget = abstracts.submissions.find(
    (submission) => submission.status === "pending" && submission.id !== acceptTarget.submission.id,
  );
  if (undoTarget === undefined) {
    return yield* Effect.fail(
      new InvalidInput({ message: "Review desk verification needs an inline status target" }),
    );
  }
  yield* reviewDesk.changeStatus(eventId, undoTarget.id, "maybe", {
    kind: "user",
    userId: "usr_dana",
    name: "Seed verification",
  });
  const undone = yield* reviewDesk.changeStatus(eventId, undoTarget.id, "pending", {
    kind: "user",
    userId: "usr_dana",
    name: "Seed verification",
  });
  const declineTargets = abstracts.submissions
    .filter(
      (submission) =>
        submission.status === "pending" &&
        submission.id !== acceptTarget.submission.id &&
        submission.id !== undoTarget.id,
    )
    .slice(0, 2);
  if (declineTargets.length !== 2) {
    return yield* Effect.fail(
      new InvalidInput({ message: "Review desk verification needs two pending submissions" }),
    );
  }
  const declined = yield* reviewDesk.decide({
    eventId,
    submissionIds: declineTargets.map((submission) => submission.id),
    decision: "decline",
    confirmRedecide: false,
    approveContent: false,
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });
  yield* reviewDesk.inform({
    eventId,
    submissionIds: declineTargets.map((submission) => submission.id),
    feedback: "A thoughtful proposal, but the program is full in this track.",
    portalOrigin: "https://app.opensesh.io",
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });
  const declinedDetail = yield* reviewDesk.detail(eventId, declineTargets[0]?.id ?? "");

  const acceptedEmails = acceptedDetail.emails.filter((email) => email.type === "accepted");
  const checks = [
    ["reviewer track queue", initialQueue.total > 0],
    ["reviewer staff bootstrap", reviewerEvents.some((event) => event.id === eventId)],
    ["review upsert", savedReview.decision === "approve" && savedReview.score === 5],
    ["review progress", reviewedQueue.reviewed === initialQueue.reviewed + 1],
    ["accepted status", acceptedDetail.submission.status === "accepted"],
    ["notified timestamp", acceptedDetail.submission.notifiedAt !== null],
    // The seed event asks speakers to confirm participation themselves, so
    // accepting must NOT auto-confirm — the email carries the confirm ask.
    [
      "confirmation requested, not auto-set",
      acceptedDetail.submission.speakers.every((speaker) => speaker.confirmedAt === null) &&
        acceptedEmails.every((email) => email.body.includes("confirm your participation")),
    ],
    ["accept tasks created", firstDecision.result.createdTasks > 0 && taskCount > 0],
    [
      "feedback email recorded",
      acceptedEmails.length === 1 &&
        acceptedEmails.every((email) => email.body.includes(feedback) && email.status === "queued"),
    ],
    [
      "accept retry idempotent",
      retry.result.createdTasks === 0 &&
        retry.result.submissions[0]?.notifiedAt?.getTime() ===
          acceptedDetail.submission.notifiedAt?.getTime() &&
        taskCountAfterRetry === taskCount,
    ],
    ["inline status undo", undone.status === "pending"],
    [
      "bulk decline",
      declined.result.submissions.length === 2 &&
        declined.result.submissions.every((submission) => submission.status === "declined") &&
        declined.result.createdTasks === 0,
    ],
    [
      "decline email recorded",
      declinedDetail.emails.some((email) => email.type === "declined" && email.status === "queued"),
    ],
  ] as const;
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) {
    return yield* Effect.fail(
      new InvalidInput({ message: `Review desk verification failed: ${failed.join(", ")}` }),
    );
  }
  return {
    checks: checks.map(([check]) => ({ check, status: "ok" })),
    reviewed: `${reviewedQueue.reviewed} of ${reviewedQueue.total}`,
    acceptedCode: acceptTarget.submission.code,
    createdTasks: firstDecision.result.createdTasks,
    createdEmails: acceptedEmails.length,
    declinedCodes: declineTargets.map((submission) => submission.code).join(", "),
  };
});

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const result = await run(verify, makeRepositoriesLive(connectionString));
  if (!result.ok) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    console.table(result.data.checks);
    console.log(
      `Review desk verification passed: ${result.data.reviewed} reviewed; accepted ${result.data.acceptedCode} (${result.data.createdTasks} tasks, ${result.data.createdEmails} emails); declined ${result.data.declinedCodes}.`,
    );
  }
}
