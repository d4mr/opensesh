import { Effect } from "effect";

import { listCfpSubmissions, loadCfpDraft, saveCfpDraft, submitCfpDraft } from "../server/cfp";
import { InvalidInput } from "../server/errors";
import { Contacts, EmailLog, Forms, Submissions, makeRepositoriesLive } from "../server/repos";
import { run } from "../server/runtime";

const email = "wp3.verify@example.com";
const answers = {
  fld_title: "WP3 mapping verification",
  fld_description: "A concrete integration check for the CFP workflow.",
  fld_format: "fmt_talk",
  fld_track: "trk_agents",
  fld_tags: ["tag_prod"],
  fld_level: "lvl_intermediate",
};
const participantAnswers = {
  fld_first: "Casey",
  fld_last: "Verifier",
  fld_email: email,
  fld_mobile: "+1 555 0100",
  fld_bio: "Builds reliable conference software.",
};
const input = {
  eventSlug: "ai-engineer-nyc-2026",
  formId: "form_sessions",
  email,
  answers,
  participants: [{ role: "speaker", answers: participantAnswers }],
};

const verify = Effect.gen(function* () {
  const contacts = yield* Contacts;
  const emailLog = yield* EmailLog;
  const forms = yield* Forms;
  const submissions = yield* Submissions;
  yield* forms.update("form_sessions", { submissionLimit: 2, status: "open" });

  const firstDraft = yield* saveCfpDraft({ ...input, submissionId: null });
  const loaded = yield* loadCfpDraft(input.eventSlug, input.formId, firstDraft.id, input.email);
  const submitted = yield* submitCfpDraft({ ...input, submissionId: firstDraft.id });
  const contact = yield* contacts.findByEmail("evt_aie_nyc_2026", email);
  const [trackIds, tagIds, participants, emails, returning] = yield* Effect.all([
    submissions.listTrackIds(firstDraft.id),
    submissions.listTagIds(firstDraft.id),
    submissions.listParticipants(firstDraft.id),
    emailLog.listByContact(contact.id),
    listCfpSubmissions(input.eventSlug, input.formId, input.email),
  ]);
  const checks = [
    ["draft reload", loaded.answers.fld_title === answers.fld_title],
    ["pending status", submitted.submission.status === "pending"],
    ["SESS code", /^SESS-\d+$/.test(submitted.submission.code)],
    ["title mapping", submitted.submission.title === answers.fld_title],
    ["description mapping", submitted.submission.description === answers.fld_description],
    ["format mapping", submitted.submission.formatId === answers.fld_format],
    ["level mapping", submitted.submission.levelId === answers.fld_level],
    ["track mapping", trackIds.includes(answers.fld_track)],
    ["tag mapping", tagIds.includes(answers.fld_tags[0])],
    ["participant link", participants.length === 1 && participants[0]?.contactId === contact.id],
    [
      "confirmation logged",
      emails.some((entry) => entry.type === "confirmation" && entry.status === "queued"),
    ],
    ["returning list", returning.some((entry) => entry.id === firstDraft.id)],
    ["success message", submitted.form.successMessage.includes("Thank you")],
  ] as const;
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) {
    return yield* Effect.fail(
      new InvalidInput({ message: `CFP verification failed: ${failed.join(", ")}` }),
    );
  }

  yield* saveCfpDraft({
    ...input,
    submissionId: null,
    answers: { ...answers, fld_title: "Second" },
  });
  const limitResult = yield* saveCfpDraft({
    ...input,
    submissionId: null,
    answers: { ...answers, fld_title: "Third" },
  }).pipe(
    Effect.match({ onFailure: (failure) => failure._tag, onSuccess: () => "unexpected-success" }),
  );
  yield* forms.update("form_sessions", { status: "closed" });
  const closedResult = yield* saveCfpDraft({ ...input, submissionId: firstDraft.id }).pipe(
    Effect.match({ onFailure: (failure) => failure._tag, onSuccess: () => "unexpected-success" }),
  );
  if (limitResult !== "SubmissionLimitReached" || closedResult !== "FormClosed") {
    return yield* Effect.fail(
      new InvalidInput({ message: "CFP limit or closed-form enforcement failed" }),
    );
  }
  return checks.map(([name]) => ({ check: name, status: "ok" }));
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
    console.table(result.data);
    console.log("CFP integration verification passed.");
  }
}
