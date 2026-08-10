import type { FormAnswers, FormField, ParticipantAnswers, Submission } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, CheckIcon, MailCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { FormRenderer } from "@/components/forms/form-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/submit/$eventSlug/$formId")({ component: PublicWizard });

const emptyAnswers = (fields: ReadonlyArray<FormField>): FormAnswers => {
  const answers: Record<string, string | ReadonlyArray<string>> = {};
  for (const field of fields) answers[field.id] = field.fieldType === "checkbox" ? [] : "";
  return answers;
};

const participantForEmail = (
  fields: ReadonlyArray<FormField>,
  email: string,
): ParticipantAnswers => {
  const answers = emptyAnswers(fields);
  const emailField = fields.find((field) => field.mapsTo === "email");
  return {
    role: "speaker",
    answers: emailField === undefined ? answers : { ...answers, [emailField.id]: email },
  };
};

function PublicWizard() {
  const { eventSlug, formId } = Route.useParams();
  const bundle = useQuery({
    queryKey: ["public-form", eventSlug, formId],
    queryFn: () => getPublicForm({ data: { eventSlug, formId } }),
  });
  const account = useQuery({
    queryKey: ["public-form-account", eventSlug, formId],
    queryFn: () => getPublicFormAccount({ data: { eventSlug, formId } }),
  });
  if (bundle.data === undefined || account.data === undefined) return null;
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
  const [step, setStepState] = useState(() => {
    if (typeof window === "undefined") return 0;
    const value = Number.parseInt(window.localStorage.getItem(`${storageKey}-step`) ?? "0", 10);
    return Number.isNaN(value) ? 0 : Math.min(4, Math.max(0, value));
  });
  const [submissionId, setSubmissionId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(`${storageKey}-draft`),
  );
  const abstractFields = fields.filter((field) => field.section === "abstract");
  const participantFields = fields.filter((field) => field.section === "participant");
  const [answers, setAnswers] = useState<FormAnswers>(() => emptyAnswers(abstractFields));
  const [participants, setParticipants] = useState<ReadonlyArray<ParticipantAnswers>>(() =>
    account.email === null ? [] : [participantForEmail(participantFields, account.email)],
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const loadedDraft = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const setStep = (next: number) => {
    window.localStorage.setItem(`${storageKey}-step`, String(next));
    setStepState(next);
  };

  useEffect(() => {
    if (account.email === null || submissionId === null || loadedDraft.current === submissionId)
      return;
    loadedDraft.current = submissionId;
    void getPublicDraft({ data: { eventSlug, formId, submissionId } }).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAnswers(result.data.answers);
      setParticipants(
        result.data.participants.length > 0
          ? result.data.participants
          : [participantForEmail(participantFields, account.email ?? "")],
      );
    });
  }, [account.email, eventSlug, formId, participantFields, submissionId]);

  const save = async () => {
    if (account.email === null) return null;
    setSaveState("saving");
    setError(undefined);
    const result = await savePublicDraft({
      data: { eventSlug, formId, submissionId, answers, participants },
    });
    if (!result.ok) {
      setSaveState("idle");
      setError(result.error.message);
      return null;
    }
    setSubmissionId(result.data.id);
    window.localStorage.setItem(`${storageKey}-draft`, result.data.id);
    setSaveState("saved");
    await queryClient.invalidateQueries({ queryKey: ["public-form-account", eventSlug, formId] });
    return result.data.id;
  };

  useEffect(() => {
    if (account.email === null || step < 2 || success) return;
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
        <Card className="mx-auto max-w-2xl">
          <CardContent className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckIcon />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Submission received</h1>
            <div
              className="prose prose-sm mx-auto mt-3 max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: form.successMessage }}
            />
            {form.autoRedirectPortal && !redirectCancelled ? (
              <p className="mt-5 text-xs text-muted-foreground">
                Going to your portal in 10 seconds…{" "}
                <button className="underline" onClick={() => setRedirectCancelled(true)}>
                  Cancel
                </button>
              </p>
            ) : null}
            <Button className="mt-5" asChild>
              <a href="/portal">Continue to portal</a>
            </Button>
          </CardContent>
        </Card>
      </PublicFrame>
    );
  }
  return (
    <PublicFrame eventName={event.name}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 grid grid-cols-5 gap-1" aria-label="Submission progress">
          {stepLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="min-w-0 text-center">
              <div
                className={cn(
                  "mx-auto flex size-6 items-center justify-center rounded-full border text-[11px] font-medium",
                  index <= step && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {index < step ? <CheckIcon className="size-3" /> : index + 1}
              </div>
              <span className="mt-1 block truncate text-[10px] text-muted-foreground sm:text-xs">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {form.closeDate === null
            ? "Submissions are open."
            : `Submissions close ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: event.timezone, timeZoneName: "short" }).format(form.closeDate)}.`}
          {limit > 0 ? ` Limit: ${limit} submissions per user.` : ""}
        </div>
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">
              {step === 0 ? form.externalTitle : stepLabels[step]}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {step === 0 ? (
              <div>
                {form.showWelcome ? (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: form.welcomeMessage }}
                  />
                ) : null}
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(1)}>
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
                onContinue={() => setStep(2)}
                onResume={(id) => void resume(id)}
              />
            ) : null}
            {step === 2 ? (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">
                  {form.abstractSection.instructions}
                </p>
                <FormRenderer
                  key={`abstract-${submissionId ?? "new"}-${loadedDraft.current ?? ""}`}
                  fields={abstractFields}
                  library={library}
                  answers={answers}
                  onAnswersChange={setAnswers}
                  onContinue={async () => {
                    if ((await save()) !== null) setStep(form.collectParticipants ? 3 : 4);
                  }}
                />
              </div>
            ) : null}
            {step === 3 ? (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">
                  {form.participantSection.instructions}
                </p>
                <div className="grid gap-3">
                  {participants.map((participant, index) => (
                    <Card key={index} className="gap-0 py-0">
                      <CardHeader className="flex-row items-center justify-between border-b py-3">
                        <CardTitle className="text-sm">Speaker {index + 1}</CardTitle>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={participants.length <= (form.participantRoles[0]?.min ?? 1)}
                          onClick={() =>
                            setParticipants(
                              participants.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-3">
                        <FormRenderer
                          fields={participantFields}
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Button
                    variant="outline"
                    disabled={participants.length >= (form.participantRoles[0]?.max ?? 3)}
                    onClick={() =>
                      setParticipants([...participants, participantForEmail(participantFields, "")])
                    }
                  >
                    <PlusIcon /> Add speaker
                  </Button>
                  <Button
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
              <div className="grid gap-5">
                <ReviewSection
                  title={form.abstractSection.title}
                  fields={abstractFields}
                  answers={answers}
                  edit={() => setStep(2)}
                />
                {form.collectParticipants
                  ? participants.map((participant, index) => (
                      <ReviewSection
                        key={index}
                        title={`Speaker ${index + 1}`}
                        fields={participantFields}
                        answers={participant.answers}
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
                    variant="outline"
                    onClick={() => setStep(form.collectParticipants ? 3 : 2)}
                  >
                    Back
                  </Button>
                  <Button onClick={() => void submit()}>Submit</Button>
                </div>
              </div>
            ) : null}
            {step >= 2 ? (
              <p
                className="mt-3 min-h-4 text-right text-[11px] text-muted-foreground"
                aria-live="polite"
              >
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
              </p>
            ) : null}
            {step !== 4 && error !== undefined ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
        </Card>
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
        <div className="flex items-center justify-between rounded-md border p-3">
          <span className="text-sm">
            Continuing as <strong>{email}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
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
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Your submissions
            </p>
            <div className="grid gap-2">
              {submissions.map((submission) => (
                <button
                  key={submission.id}
                  className="flex items-center justify-between rounded-md border p-3 text-left"
                  onClick={() => onResume(submission.id)}
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {submission.title || "Untitled draft"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{submission.code}</span> ·{" "}
                      {submission.status}
                    </span>
                  </span>
                  <span className="text-xs text-primary">
                    {submission.status === "draft" ? "Resume" : "Edit"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end">
          <Button onClick={onContinue}>
            Start a submission <ArrowRightIcon />
          </Button>
        </div>
      </div>
    );
  }
  if (sent !== undefined) {
    return (
      <div className="py-6 text-center">
        <MailCheckIcon className="mx-auto size-8 text-primary" />
        <h2 className="mt-3 font-semibold">Check your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a sign-in link to {sent.email}.
        </p>
        {sent.link === undefined ? null : (
          <Button className="mt-4" asChild>
            <a href={sent.link}>Open demo magic link</a>
          </Button>
        )}
      </div>
    );
  }
  return (
    <form
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
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldDescription>We’ll email you a secure link. No password needed.</FieldDescription>
          </Field>
        )}
      </form.Field>
      {error === undefined ? null : <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex justify-end">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Email me a magic link"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

function ReviewSection({
  title,
  fields,
  answers,
  edit,
}: {
  readonly title: string;
  readonly fields: ReadonlyArray<FormField>;
  readonly answers: FormAnswers;
  readonly edit: () => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={edit}>
          Edit
        </Button>
      </div>
      <dl className="divide-y rounded-md border">
        {fields.map((field) => {
          const value = answers[field.id];
          const display = Array.isArray(value)
            ? value.join(", ")
            : typeof value === "string"
              ? value.replace(/<[^>]+>/g, " ").trim()
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
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-center gap-2 px-4 text-sm font-semibold">
          <BrandMark className="size-6" /> {eventName}
        </div>
      </header>
      <main className="p-3 py-6 sm:p-6">{children}</main>
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
      <Card className="mx-auto max-w-xl">
        <CardContent className="py-10 text-center">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </PublicFrame>
  );
}
