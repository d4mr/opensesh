import { Effect, Layer } from "effect";

import { InvalidInput, MailError } from "../server/errors";
import { Mail, makeMailLive } from "../server/mail";
import { MailAdmin, ReviewDesk, Submissions, makeRepositoriesLive } from "../server/repos";
import { run } from "../server/runtime";

const eventId = "evt_aie_nyc_2026";

const verify = Effect.gen(function* () {
  const admin = yield* MailAdmin;
  const mail = yield* Mail;
  const submissions = yield* Submissions;
  const before = yield* admin.calendarSummary(eventId);
  const invitations = yield* admin.queueCalendarInvites(eventId, "http://localhost:3007");
  const invitationResults = yield* Effect.forEach(
    invitations,
    (invitation) => mail.sendQueued(invitation.logId),
    { concurrency: 5 },
  );
  const after = yield* admin.calendarSummary(eventId);
  const initialEmails = yield* admin.list(eventId);
  const initialInvite = initialEmails.find((email) => email.type === "calendar_invite");
  if (initialInvite?.submissionId === null || initialInvite?.submissionId === undefined) {
    return yield* Effect.fail(new InvalidInput({ message: "No calendar invitation was stored" }));
  }
  const scheduled = yield* submissions.get(initialInvite.submissionId);
  if (scheduled.startsAt === null || scheduled.endsAt === null) {
    return yield* Effect.fail(new InvalidInput({ message: "Calendar session is not scheduled" }));
  }
  yield* submissions.update(scheduled.id, {
    startsAt: new Date(scheduled.startsAt.getTime() + 15 * 60_000),
    endsAt: new Date(scheduled.endsAt.getTime() + 15 * 60_000),
    scheduleDirty: true,
  });
  const dirty = yield* admin.calendarSummary(eventId);
  const rescheduled = yield* admin.queueCalendarInvites(eventId, "http://localhost:3007");
  const rescheduledResults = yield* Effect.forEach(
    rescheduled,
    (invitation) => mail.sendQueued(invitation.logId),
    { concurrency: 5 },
  );
  const cleanAfterReschedule = yield* admin.calendarSummary(eventId);
  const reminders = yield* admin.queueTaskReminders(eventId, null, "http://localhost:3007");
  const reminderResults = yield* Effect.forEach(
    reminders,
    (reminder) => mail.sendQueued(reminder.logId),
    { concurrency: 5 },
  );
  const emails = yield* admin.list(eventId);
  const calendarEmails = emails.filter((email) => email.type === "calendar_invite");
  const reminderEmails = emails.filter((email) => email.type === "task_reminder");
  const checks = [
    ["scheduled speakers need invitations", before.affectedSpeakers > 0],
    ["one invite queued per affected speaker", invitations.length === before.affectedSpeakers],
    [
      "calendar invitations delivered in demo mode",
      invitationResults.every((result) => result.status === "demo"),
    ],
    ["calendar coverage clean after send", after.affectedSpeakers === 0],
    ["reschedule marks every session speaker dirty", dirty.affectedSpeakers > 0],
    [
      "reschedule sends a higher ICS sequence",
      rescheduledResults.length === dirty.affectedSpeakers &&
        rescheduledResults.every((result) => result.status === "demo") &&
        cleanAfterReschedule.affectedSpeakers === 0 &&
        calendarEmails.some(
          (email) =>
            email.submissionId === initialInvite.submissionId &&
            email.icsSequence === (initialInvite.icsSequence ?? 0) + 1,
        ),
    ],
    [
      "calendar HTML and ICS stored",
      calendarEmails.every(
        (email) =>
          email.htmlBody.includes("Add the attached invitation") &&
          email.icsContent?.includes("METHOD:REQUEST") === true &&
          email.icsContent.includes(`SEQUENCE:${email.icsSequence ?? -1}`),
      ),
    ],
    ["outstanding speakers receive reminders", reminders.length > 0],
    [
      "task reminders delivered in demo mode",
      reminderResults.every((result) => result.status === "demo"),
    ],
    [
      "reminder task lists stored in HTML",
      reminderEmails.every((email) => email.htmlBody.includes("speaker tasks are outstanding")),
    ],
  ] as const;
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) {
    return yield* Effect.fail(
      new InvalidInput({ message: `Mail verification failed: ${failed.join(", ")}` }),
    );
  }
  return {
    checks: checks.map(([name]) => ({ check: name, status: "ok" })),
    calendarInvites: invitationResults.length + rescheduledResults.length,
    reminders: reminderResults.length,
  };
});

// The demo workspace is log-only: even with a transport that would blow up,
// a demo-org decision must complete and its email must be recorded as "demo"
// with no error — proof the transport is never invoked for the sandbox.
const verifyFailure = Effect.gen(function* () {
  const reviewDesk = yield* ReviewDesk;
  const mail = yield* Mail;
  const admin = yield* MailAdmin;
  const decision = yield* reviewDesk.decide({
    eventId,
    submissionIds: ["sub_02"],
    decision: "accept",
    feedback: "Strong practical proposal.",
    confirmRedecide: false,
    approveContent: true,
    actor: { kind: "user", userId: "usr_dana", name: "Seed verification" },
  });
  const deliveries = yield* Effect.forEach(
    decision.deliveries,
    (delivery) => mail.sendLogged(delivery.logId, delivery.mail),
    { concurrency: 5 },
  );
  const emails = yield* admin.list(eventId);
  const logged = emails.find((email) => email.id === deliveries[0]?.id);
  if (
    decision.result.submissions[0]?.status !== "accepted" ||
    logged?.status !== "demo" ||
    logged.error !== null
  ) {
    return yield* Effect.fail(
      new InvalidInput({ message: "Demo-org decision email reached the transport" }),
    );
  }
  return logged.id;
});

// Re-sending the same logged email is idempotent and still never delivers.
const verifyRetry = (emailId: string) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    const retried = yield* mail.sendQueued(emailId);
    if (retried.status !== "demo") {
      return yield* Effect.fail(
        new InvalidInput({ message: "Demo-org email resend was not log-only" }),
      );
    }
    return retried;
  });

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const repositories = makeRepositoriesLive(connectionString);
  const mail = makeMailLive(
    connectionString,
    true,
    () => Effect.succeed({ providerId: null }),
    "cloudflare",
  );
  const result = await run(verify, Layer.merge(repositories, mail));
  if (!result.ok) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    const brokenMail = makeMailLive(
      connectionString,
      false,
      () =>
        Effect.fail(
          new MailError({
            message: "Intentional provider failure",
            cause: new Error("Intentional provider failure"),
          }),
        ),
      "resend",
    );
    const failed = await run(verifyFailure, Layer.merge(repositories, brokenMail));
    if (!failed.ok) {
      console.error(failed.error.message);
      process.exitCode = 1;
    } else {
      const retried = await run(verifyRetry(failed.data), Layer.merge(repositories, mail));
      if (!retried.ok) {
        console.error(retried.error.message);
        process.exitCode = 1;
      } else {
        console.log(
          "Sandbox isolation passed: decision accepted, transport never invoked, resend log-only.",
        );
      }
    }
    console.table(result.data.checks);
    console.log(
      `Mail verification passed: ${result.data.calendarInvites} calendar invites, ${result.data.reminders} task reminders.`,
    );
  }
}
