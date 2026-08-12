import {
  plainTextFromRichText,
  type FormAnswers,
  type FormField,
  type ParticipantAnswers,
  type Submission,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, CheckIcon, MailCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { qk } from "@/lib/query-keys";
import { BrandMark } from "@/components/app/brand-mark";
import { FormRenderer } from "@/components/forms/form-renderer";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/forms/rich-text";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { requestMagicLink } from "@/server-fns/auth";
import {
  getPublicDraft,
  getPublicForm,
  getPublicFormAccount,
  savePublicDraft,
  submitPublicDraft,
} from "@/server-fns/cfp";

const publicFormQuery = (eventSlug: string, formId: string) =>
  queryOptions({
    queryKey: qk.public.form(eventSlug, formId),
    queryFn: () => getPublicForm({ data: { eventSlug, formId } }),
    staleTime: 30_000,
  });

const publicFormAccountQuery = (eventSlug: string, formId: string) =>
  queryOptions({
    queryKey: qk.public.formAccount(eventSlug, formId),
    queryFn: () => getPublicFormAccount({ data: { eventSlug, formId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/submit/$eventSlug/$formId")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(publicFormQuery(params.eventSlug, params.formId)),
      context.queryClient.ensureQueryData(publicFormAccountQuery(params.eventSlug, params.formId)),
    ]),
  component: PublicWizard,
});

const emptyAnswers = (fields: ReadonlyArray<FormField>): FormAnswers => {
  const answers: Record<string, string | ReadonlyArray<string>> = {};
  for (const field of fields) answers[field.id] = field.fieldType === "checkbox" ? [] : "";
  return answers;
};

const participantForEmail = (
  fields: ReadonlyArray<FormField>,
  email: string,
  role: string,
): ParticipantAnswers => {
  const answers = emptyAnswers(fields);
  const emailField = fields.find((field) => field.mapsTo === "email");
  return {
    role,
    answers: emailField === undefined ? answers : { ...answers, [emailField.id]: email },
  };
};

function PublicWizard() {
  const { eventSlug, formId } = Route.useParams();
  const bundle = useSuspenseQuery(publicFormQuery(eventSlug, formId));
  const account = useSuspenseQuery(publicFormAccountQuery(eventSlug, formId));
  if (!bundle.data.ok)
    return <PublicState title="Form not found" message={bundle.data.error.message} />;
  if (!account.data.ok)
    return <PublicState title="Could not load your account" message={account.data.error.message} />;
  const { event, form, fields, library } = bundle.data.data;
  const closed =
    form.status === "closed" || (form.closeDate !== null && form.closeDate <= new Date());
  if (closed)
    return (
      <PublicState
        eventName={event.name}
        title="Submissions are closed"
        message="This form is no longer accepting new or updated submissions."
      />
    );
  return (
    <Wizard
      key={`${form.id}-${account.data.data.email ?? "guest"}`}
      eventSlug={eventSlug}
      formId={formId}
      event={event}
      form={form}
      fields={fields}
      library={library}
      account={account.data.data}
    />
  );
}

function Wizard({
  eventSlug,
  formId,
  event,
  form,
  fields,
  library,
  account,
}: {
  readonly eventSlug: string;
  readonly formId: string;
  readonly event: {
    readonly name: string;
    readonly timezone: string;
    readonly defaultSubmissionLimit: number;
  };
  readonly form: import("@opensesh/domain").Form;
  readonly fields: ReadonlyArray<FormField>;
  readonly library: import("@/components/forms/form-renderer").FormRendererLibrary;
  readonly account: {
    readonly email: string | null;
    readonly submissions: ReadonlyArray<Submission>;
  };
}) {
  const storageKey = `opensesh-cfp-${formId}`;
  // Server HTML and the hydration render must be identical, so persisted
  // wizard position is restored in an effect below — never in an initializer.
  const [step, setStepState] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const abstractFields = fields.filter((field) => field.section === "abstract");
  const participantFields = fields.filter((field) => field.section === "participant");
  const enabledRoles = form.participantRoles.filter((role) => role.enabled);
  const roleForPosition = (position: number) =>
    enabledRoles[Math.min(position, enabledRoles.length - 1)]?.role ?? "speaker";
  const minimumParticipants = enabledRoles.reduce((total, role) => total + role.min, 0);
  const maximumParticipants = enabledRoles.reduce((total, role) => total + role.max, 0);
  const [answers, setAnswers] = useState<FormAnswers>(() => emptyAnswers(abstractFields));
  const [participants, setParticipants] = useState<ReadonlyArray<ParticipantAnswers>>(() =>
    account.email === null
      ? []
      : [participantForEmail(participantFields, account.email, roleForPosition(0))],
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const [maxStep, setMaxStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  // Remembers the last hovered segment so the tooltip keeps its text and
  // position while fading out.
  const tooltipStep = useRef(0);
  const loadedDraft = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const setStep = (next: number) => {
    window.localStorage.setItem(`${storageKey}-step`, String(next));
    setMaxStep((current) => Math.max(current, next));
    setStepState(next);
  };

  // Restore the persisted wizard position once the client owns the DOM.
  // A step beyond Account is only meaningful with a draft and a signed-in
  // account; otherwise a stale key would open a blank Review over an empty
  // form.
  useEffect(() => {
    const draft = window.localStorage.getItem(`${storageKey}-draft`);
    const value = Number.parseInt(window.localStorage.getItem(`${storageKey}-step`) ?? "0", 10);
    const stored = Number.isNaN(value) ? 0 : Math.min(4, Math.max(0, value));
    const restored = draft === null || account.email === null ? Math.min(stored, 1) : stored;
    if (draft !== null && account.email !== null) setSubmissionId(draft);
    if (restored > 0) {
      setStepState(restored);
      setMaxStep((current) => Math.max(current, restored));
    }
    // Runs once per form: restoring again on account changes would yank the
    // wizard out from wherever the user has navigated since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // The stored draft id is a cache hint, not truth — the row can be gone
  // (database reseed) or owned by someone else after an account switch. When
  // the server rejects it, discard the pointer and reset to a clean start
  // instead of dead-ending every subsequent save.
  const resetToFresh = (message?: string) => {
    window.localStorage.removeItem(`${storageKey}-draft`);
    setSubmissionId(null);
    loadedDraft.current = null;
    setAnswers(emptyAnswers(abstractFields));
    setParticipants(
      account.email === null
        ? []
        : [participantForEmail(participantFields, account.email, roleForPosition(0))],
    );
    setError(undefined);
    setNotice(message);
  };

  useEffect(() => {
    if (account.email === null || submissionId === null || loadedDraft.current === submissionId)
      return;
    loadedDraft.current = submissionId;
    void getPublicDraft({ data: { eventSlug, formId, submissionId } }).then((result) => {
      if (!result.ok) {
        if (result.error.status === 404 || result.error.status === 403) {
          resetToFresh("Your previous draft is no longer available, so this starts fresh.");
          setStepState((current) => Math.min(current, 2));
          return;
        }
        setError(result.error.message);
        return;
      }
      setAnswers(result.data.answers);
      setParticipants(
        result.data.participants.length > 0
          ? result.data.participants
          : [participantForEmail(participantFields, account.email ?? "", roleForPosition(0))],
      );
    });
  }, [account.email, eventSlug, formId, participantFields, submissionId]);

  const save = async () => {
    // A signed-out session (expired or never signed in) cannot save; a silent
    // null here would make Continue a dead click, so route to the sign-in step.
    if (account.email === null) {
      setStep(1);
      return null;
    }
    setSaveState("saving");
    setError(undefined);
    let result = await savePublicDraft({
      data: { eventSlug, formId, submissionId, answers, participants },
    });
    // 404 on an existing id means the draft row is gone (reseed, account
    // switch) — save the same content as a new draft rather than dead-ending.
    if (!result.ok && result.error.status === 404 && submissionId !== null) {
      window.localStorage.removeItem(`${storageKey}-draft`);
      setSubmissionId(null);
      loadedDraft.current = null;
      setNotice("Your previous draft was no longer available, so this saved as a new draft.");
      result = await savePublicDraft({
        data: { eventSlug, formId, submissionId: null, answers, participants },
      });
    }
    if (!result.ok) {
      setSaveState("idle");
      setError(result.error.message);
      return null;
    }
    setSubmissionId(result.data.id);
    window.localStorage.setItem(`${storageKey}-draft`, result.data.id);
    setSaveState("saved");
    await invalidateAfterMutation(queryClient);
    return result.data.id;
  };

  const hasAnswerContent = Object.values(answers).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : typeof value === "string"
        ? value.trim() !== ""
        : value != null,
  );

  useEffect(() => {
    if (account.email === null || step < 2 || success) return;
    // Never mint an empty draft — resetting to a fresh form changes state
    // references without there being anything worth persisting yet.
    if (submissionId === null && !hasAnswerContent) return;
    setSaveState("idle");
    const timeout = window.setTimeout(() => void save(), 700);
    return () => window.clearTimeout(timeout);
  }, [answers, participants]);

  useEffect(() => {
    if (!success || !form.autoRedirectPortal || redirectCancelled) return;
    const timeout = window.setTimeout(() => window.location.assign("/portal"), 10_000);
    return () => window.clearTimeout(timeout);
  }, [form.autoRedirectPortal, redirectCancelled, success]);

  const resume = async (id: string) => {
    setSubmissionId(id);
    window.localStorage.setItem(`${storageKey}-draft`, id);
    setStep(2);
  };
  const submit = async () => {
    const id = await save();
    if (id === null) return;
    const result = await submitPublicDraft({
      data: { eventSlug, formId, submissionId: id, answers, participants },
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    window.localStorage.removeItem(`${storageKey}-draft`);
    window.localStorage.removeItem(`${storageKey}-step`);
    setSuccess(true);
  };
  const stepLabels = [
    form.welcomeHeading,
    "Account",
    form.abstractSection.heading,
    form.participantSection.heading,
    "Review",
  ];
  const limit = form.submissionLimit ?? event.defaultSubmissionLimit;
  if (success) {
    return (
      <PublicFrame eventName={event.name}>
        <div className="wizard-step py-12 text-center">
          <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Submission received</h1>
          <RichText
            markdown={form.successMessage}
            className="mx-auto mt-3 text-sm text-muted-foreground"
          />
          {form.autoRedirectPortal && !redirectCancelled ? (
            <p className="mt-5 text-xs text-muted-foreground">
              Going to your portal in 10 seconds…{" "}
              <button className="underline" onClick={() => setRedirectCancelled(true)}>
                Cancel
              </button>
            </p>
          ) : null}
          <Button className="pressable mt-6" asChild>
            <a href="/portal">Continue to portal</a>
          </Button>
        </div>
      </PublicFrame>
    );
  }
  const closeLabel =
    form.closeDate === null
      ? null
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: event.timezone,
          timeZoneName: "short",
        }).format(form.closeDate);
  const heading =
    step === 0
      ? form.externalTitle
      : step === 1
        ? account.email === null
          ? "Sign in to continue"
          : "Welcome back"
        : stepLabels[step];
  const subtitle =
    step === 1
      ? account.email === null
        ? "We’ll email you a secure sign-in link — no password needed."
        : "Resume a draft below, or start a new submission."
      : step === 2
        ? form.abstractSection.instructions
        : step === 3
          ? form.participantSection.instructions
          : step === 4
            ? "Check everything before you submit."
            : null;
  return (
    <PublicFrame eventName={event.name}>
      <nav className="mb-8" aria-label="Submission progress">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">
            Step {step + 1} of {stepLabels.length}
            <span className="text-muted-foreground"> · {stepLabels[step]}</span>
          </span>
          <span className="text-muted-foreground" aria-live="polite">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : closeLabel === null
                  ? "Submissions open"
                  : `Closes ${closeLabel}`}
          </span>
        </div>
        <div className="relative mt-1" onMouseLeave={() => setHoveredStep(null)}>
          <div className="flex gap-1">
            {stepLabels.map((label, index) => (
              <button
                key={`${label}-${index}`}
                type="button"
                tabIndex={index < step ? 0 : -1}
                aria-label={index < step ? `Back to ${label}` : label}
                className={cn(
                  "group flex h-4 flex-1 items-center",
                  index < step ? "cursor-pointer" : "cursor-default",
                )}
                onMouseEnter={() => {
                  tooltipStep.current = index;
                  setHoveredStep(index);
                }}
                onFocus={() => {
                  tooltipStep.current = index;
                  setHoveredStep(index);
                }}
                onBlur={() => setHoveredStep(null)}
                onClick={() => {
                  if (index < step) setStep(index);
                }}
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors duration-300 [transition-timing-function:var(--ease-out)]",
                    index <= step ? "bg-primary" : index <= maxStep ? "bg-primary/30" : "bg-muted",
                    index < step && "group-hover:bg-primary/70",
                  )}
                />
              </button>
            ))}
          </div>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[11px] font-medium whitespace-nowrap text-popover-foreground shadow-md transition-[left,opacity,transform] duration-200 [transition-timing-function:var(--ease-out)]",
              hoveredStep === null && "translate-y-1 opacity-0",
            )}
            style={{
              left: `${((hoveredStep ?? tooltipStep.current) + 0.5) * (100 / stepLabels.length)}%`,
            }}
          >
            {stepLabels[hoveredStep ?? tooltipStep.current]}
          </div>
        </div>
      </nav>
      <div key={step} className="wizard-step">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
          {subtitle === null ? null : (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </header>
        {step === 0 ? (
          <div>
            {form.showWelcome ? (
              <RichText markdown={form.welcomeMessage} className="text-sm text-muted-foreground" />
            ) : null}
            <p className="mt-4 text-xs text-muted-foreground">
              {closeLabel === null ? "Submissions are open." : `Submissions close ${closeLabel}.`}
              {limit > 0 ? ` Up to ${limit} submissions per person.` : ""}
            </p>
            <div className="mt-6 flex justify-end border-t pt-4">
              <Button className="pressable" onClick={() => setStep(1)}>
                Continue <ArrowRightIcon />
              </Button>
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <AccountStep
            email={account.email}
            submissions={account.submissions}
            callbackUrl={`/submit/${eventSlug}/${formId}`}
            onContinue={() => {
              // Starting fresh is explicit: any restored draft pointer or
              // half-filled answers from an earlier session must not leak in.
              resetToFresh(undefined);
              setStep(2);
            }}
            onResume={(id) => void resume(id)}
          />
        ) : null}
        {step === 2 ? (
          <FormRenderer
            key={`abstract-${submissionId ?? "new"}-${loadedDraft.current ?? ""}`}
            className="wizard-fields"
            fields={abstractFields}
            timezone={event.timezone}
            library={library}
            answers={answers}
            onAnswersChange={setAnswers}
            onBack={() => setStep(1)}
            onContinue={async () => {
              if ((await save()) !== null) setStep(form.collectParticipants ? 3 : 4);
            }}
          />
        ) : null}
        {step === 3 ? (
          <div>
            <div className="grid gap-4">
              {participants.map((participant, index) => (
                <section key={index} className="overflow-hidden rounded-lg border">
                  <div className="flex h-10 items-center justify-between border-b bg-muted/40 pr-1.5 pl-3">
                    <span className="text-[13px] font-medium">{participant.role}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={participants.length <= minimumParticipants}
                      onClick={() =>
                        setParticipants(participants.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <div className="p-4">
                    <FormRenderer
                      idPrefix={`participant-${index}-`}
                      className="wizard-fields"
                      fields={participantFields}
                      timezone={event.timezone}
                      library={library}
                      answers={participant.answers}
                      onAnswersChange={(next) =>
                        setParticipants(
                          participants.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, answers: next } : item,
                          ),
                        )
                      }
                      onContinue={() => undefined}
                      showContinue={false}
                    />
                  </div>
                </section>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="pressable mt-3 text-muted-foreground"
              disabled={participants.length >= maximumParticipants}
              onClick={() =>
                setParticipants([
                  ...participants,
                  participantForEmail(participantFields, "", roleForPosition(participants.length)),
                ])
              }
            >
              <PlusIcon /> Add speaker
            </Button>
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <Button variant="ghost" className="pressable" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                className="pressable"
                onClick={() =>
                  void save().then((id) => {
                    if (id !== null) setStep(4);
                  })
                }
              >
                Review
              </Button>
            </div>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="grid gap-6">
            <ReviewSection
              title={form.abstractSection.title}
              fields={abstractFields}
              answers={answers}
              library={library}
              edit={() => setStep(2)}
            />
            {form.collectParticipants
              ? participants.map((participant, index) => (
                  <ReviewSection
                    key={index}
                    title={participant.role}
                    fields={participantFields}
                    answers={participant.answers}
                    library={library}
                    edit={() => setStep(3)}
                  />
                ))
              : null}
            {error === undefined ? null : (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="ghost"
                className="pressable"
                onClick={() => setStep(form.collectParticipants ? 3 : 2)}
              >
                Back
              </Button>
              <Button className="pressable" onClick={() => void submit()}>
                Submit
              </Button>
            </div>
          </div>
        ) : null}
        {step !== 4 && error !== undefined ? (
          <p className="mt-4 text-[13px] text-destructive">{error}</p>
        ) : null}
        {notice === undefined ? null : (
          <p className="mt-4 rounded-md border bg-muted/40 p-3 text-[13px] text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </PublicFrame>
  );
}

function AccountStep({
  email,
  submissions,
  callbackUrl,
  onContinue,
  onResume,
}: {
  readonly email: string | null;
  readonly submissions: ReadonlyArray<Submission>;
  readonly callbackUrl: string;
  readonly onContinue: () => void;
  readonly onResume: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<{ readonly email: string; readonly link?: string }>();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await requestMagicLink({ data: { email: value.email, callbackUrl } });
      if (!result.ok) setError(result.error.message);
      else
        setSent({
          email: value.email,
          ...(result.data.demoLink === undefined ? {} : { link: result.data.demoLink }),
        });
    },
  });
  if (email !== null) {
    return (
      <div>
        <div className="flex items-center justify-between rounded-lg border py-2 pr-1.5 pl-3">
          <span className="text-sm">
            Continuing as <span className="font-medium">{email}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              void authClient.signOut().then(() => {
                void queryClient.invalidateQueries();
                window.location.reload();
              })
            }
          >
            Switch account
          </Button>
        </div>
        {submissions.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Your submissions
            </p>
            <div className="divide-y overflow-hidden rounded-lg border">
              {submissions.map((submission) => {
                // Decided submissions are managed from the speaker portal —
                // the wizard only edits drafts and pending submissions, so a
                // dead-end Edit button never renders here.
                const editable = submission.status === "draft" || submission.status === "pending";
                const summary = (
                  <span>
                    <span className="block text-sm font-medium">
                      {submission.title || "Untitled draft"}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground capitalize">
                      <span className="font-mono tabular-nums">{submission.code}</span> ·{" "}
                      {submission.status}
                    </span>
                  </span>
                );
                if (!editable) {
                  return (
                    <div
                      key={submission.id}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      {summary}
                      <span className="text-xs text-muted-foreground">Managed in portal</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={submission.id}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => onResume(submission.id)}
                  >
                    {summary}
                    <span className="text-xs font-medium text-primary">
                      {submission.status === "draft" ? "Resume" : "Edit"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end border-t pt-4">
          <Button className="pressable" onClick={onContinue}>
            Start a submission <ArrowRightIcon />
          </Button>
        </div>
      </div>
    );
  }
  if (sent !== undefined) {
    return (
      <div className="wizard-step py-8 text-center">
        <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full border bg-muted/40">
          <MailCheckIcon className="size-5 text-primary" />
        </span>
        <h2 className="mt-4 font-semibold tracking-tight">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a sign-in link to {sent.email}.
        </p>
        {sent.link === undefined ? null : (
          <Button className="pressable mt-5" asChild>
            <a href={sent.link}>Open demo magic link</a>
          </Button>
        )}
      </div>
    );
  }
  return (
    <form
      className="wizard-fields grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>Email</FieldLabel>
            <Input
              id={field.name}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </Field>
        )}
      </form.Field>
      {error === undefined ? null : <p className="text-[13px] text-destructive">{error}</p>}
      <div className="mt-2 flex justify-end border-t pt-4">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" className="pressable" disabled={submitting}>
              {submitting ? "Sending…" : "Email me a magic link"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

const optionName = (
  field: FormField,
  value: string,
  library: import("@/components/forms/form-renderer").FormRendererLibrary,
) => {
  if (value === "true") return "Yes";
  if (field.options === null || !("bind" in field.options)) return value;
  const list =
    field.options.bind === "track"
      ? library.tracks
      : field.options.bind === "format"
        ? library.formats
        : field.options.bind === "tags"
          ? library.tags
          : library.levels;
  return list.find((option) => option.id === value)?.name ?? value;
};

function ReviewSection({
  title,
  fields,
  answers,
  library,
  edit,
}: {
  readonly title: string;
  readonly fields: ReadonlyArray<FormField>;
  readonly answers: FormAnswers;
  readonly library: import("@/components/forms/form-renderer").FormRendererLibrary;
  readonly edit: () => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium">{title}</h2>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={edit}>
          Edit
        </Button>
      </div>
      <dl className="divide-y overflow-hidden rounded-lg border">
        {fields.map((field) => {
          const value = answers[field.id];
          const display = Array.isArray(value)
            ? value
                .filter((item): item is string => typeof item === "string")
                .map((item) => optionName(field, item, library))
                .join(", ")
            : typeof value === "string"
              ? field.fieldType === "dropdown"
                ? optionName(field, value, library)
                : plainTextFromRichText(value)
              : value === true
                ? "Yes"
                : "—";
          return (
            <div key={field.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[160px_1fr]">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm">{display || "—"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function PublicFrame({
  eventName,
  children,
}: {
  readonly eventName: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-xl items-center gap-2 px-4 text-sm sm:px-0">
          <BrandMark className="size-5" />
          <span className="font-semibold">{eventName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-0 sm:py-10">{children}</main>
    </div>
  );
}

function PublicState({
  eventName = "opensesh",
  title,
  message,
}: {
  readonly eventName?: string;
  readonly title: string;
  readonly message: string;
}) {
  return (
    <PublicFrame eventName={eventName}>
      <div className="wizard-step py-12 text-center">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </PublicFrame>
  );
}
