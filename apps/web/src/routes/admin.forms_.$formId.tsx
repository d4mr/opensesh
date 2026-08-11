import type {
  EventAdmin,
  Form,
  FormField,
  FormFieldReplacement,
  FormSectionSettings as FormSectionSettingsValue,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  SaveIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { FormFieldBuilder } from "@/components/forms/form-field-builder";
import type { FormRendererLibrary } from "@/components/forms/form-renderer";
import { DateTimePicker } from "@/components/forms/datetime-picker";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getFormEditor, saveForm } from "@/server-fns/forms";
import { getAdminBootstrap } from "@/server-fns/admin";

const adminEventsQuery = queryOptions({
  queryKey: ["admin-events"],
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

const formEditorQuery = (eventId: string, formId: string) =>
  queryOptions({
    queryKey: ["form-editor", eventId, formId],
    queryFn: () => getFormEditor({ data: { eventId, formId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/forms_/$formId")({
  loader: async ({ context, params }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(formEditorQuery(eventId, params.formId));
    }
  },
  component: FormEditorRoute,
});

const steps = [
  ["Setup", "Submission type and participants"],
  ["Welcome", "Public title and introduction"],
  ["Submission questions", "Session or abstract fields"],
  ["Participant questions", "Speaker roles and contact fields"],
  ["Settings", "Deadline, limit, and success page"],
  ["Notifications", "Confirmation and admin alerts"],
] as const;

const dateInput = (date: Date | null) => {
  if (date === null) return "";
  return date.toISOString();
};

const editorFields = (fields: ReadonlyArray<FormField>): ReadonlyArray<FormFieldReplacement> =>
  fields.map((field) => ({
    id: field.id,
    section: field.section,
    label: field.label,
    fieldType: field.fieldType,
    maxChars: field.maxChars,
    required: field.required,
    locked: field.locked,
    position: field.position,
    options: field.options,
    mapsTo: field.mapsTo,
    condition: field.condition,
  }));

function FormEditorRoute() {
  const context = useAdminEvent();
  const { formId } = Route.useParams();
  const eventId = context?.event.id;
  const editor = useSuspenseQuery(formEditorQuery(eventId ?? "", formId));
  if (context === null || eventId === undefined) return null;
  if (!editor.data.ok) return <p className="p-6 text-sm">{editor.data.error.message}</p>;
  return (
    <FormEditor
      key={`${eventId}-${formId}`}
      eventSlug={context.event.slug}
      eventTimezone={context.event.timezone}
      eventLimit={context.event.defaultSubmissionLimit}
      data={editor.data.data}
    />
  );
}

function FormEditor({
  data,
  eventSlug,
  eventTimezone,
  eventLimit,
}: {
  readonly data: {
    readonly form: Form;
    readonly fields: ReadonlyArray<FormField>;
    readonly admins: ReadonlyArray<EventAdmin>;
    readonly library: FormRendererLibrary;
  };
  readonly eventSlug: string;
  readonly eventTimezone: string;
  readonly eventLimit: number;
}) {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<ReadonlyArray<FormFieldReplacement>>(() =>
    editorFields(data.fields),
  );
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const publicPath = `/submit/${eventSlug}/${data.form.id}`;
  const form = useForm({
    defaultValues: {
      kind: data.form.kind,
      collectParticipants: data.form.collectParticipants,
      status: data.form.status,
      internalName: data.form.internalName,
      externalTitle: data.form.externalTitle,
      welcomeHeading: data.form.welcomeHeading,
      welcomeMessage: data.form.welcomeMessage,
      showWelcome: data.form.showWelcome,
      abstractSection: { ...data.form.abstractSection },
      participantSection: { ...data.form.participantSection },
      participantRoles: data.form.participantRoles.map((role) => ({ ...role })),
      closeDate: dateInput(data.form.closeDate),
      submissionLimit: data.form.submissionLimit,
      allowMultipleDrafts: data.form.allowMultipleDrafts,
      successMessage: data.form.successMessage,
      autoRedirectPortal: data.form.autoRedirectPortal,
      confirmationEmailEnabled: data.form.confirmationEmailEnabled,
      confirmationEmailBody: data.form.confirmationEmailBody,
      adminAlertUserIds: [...data.form.adminAlertUserIds],
    },
  });
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const buildPayload = () => {
    const value = form.state.values;
    return {
      eventId: data.form.eventId,
      formId: data.form.id,
      form: {
        kind: value.kind,
        collectParticipants: value.collectParticipants,
        status: value.status,
        internalName: value.internalName,
        externalTitle: value.externalTitle,
        welcomeHeading: value.welcomeHeading,
        welcomeMessage: value.welcomeMessage,
        showWelcome: value.showWelcome,
        abstractSection: value.abstractSection,
        participantSection: value.participantSection,
        participantRoles: value.participantRoles,
        closeDate: value.closeDate.length === 0 ? null : new Date(value.closeDate),
        submissionLimit: value.submissionLimit,
        allowMultipleDrafts: value.allowMultipleDrafts,
        successMessage: value.successMessage,
        autoRedirectPortal: value.autoRedirectPortal,
        confirmationEmailEnabled: value.confirmationEmailEnabled,
        confirmationEmailBody: value.confirmationEmailBody,
        adminAlertUserIds: value.adminAlertUserIds,
      },
      fields: fieldsRef.current,
    };
  };
  const buildPayloadRef = useRef(buildPayload);
  buildPayloadRef.current = buildPayload;
  // Saves never block the UI: navigation switches steps instantly and the
  // payload persists in the background. In-flight saves serialize — a change
  // made mid-save queues one trailing save with the then-current values.
  // Field ids are minted client-side, so responses need no state sync-back.
  const lastSavedRef = useRef<string | null>(null);
  if (lastSavedRef.current === null) lastSavedRef.current = JSON.stringify(buildPayload());
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const persist = async (): Promise<void> => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const payload = buildPayloadRef.current();
    const json = JSON.stringify(payload);
    if (json === lastSavedRef.current) {
      setSaveState("saved");
      return;
    }
    inFlightRef.current = true;
    setSaveState("saving");
    const result = await saveForm({ data: payload });
    inFlightRef.current = false;
    if (!result.ok) {
      setSaveState("error");
      toast.error(result.error.message);
      return;
    }
    lastSavedRef.current = json;
    if (queuedRef.current) {
      queuedRef.current = false;
      return persist();
    }
    setSaveState(
      JSON.stringify(buildPayloadRef.current()) === lastSavedRef.current ? "saved" : "dirty",
    );
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const changeStep = (next: number) => {
    setStep(next);
    void persist();
  };
  const markDirty = () => {
    if (inFlightRef.current) return;
    setSaveState((current) =>
      JSON.stringify(buildPayloadRef.current()) === lastSavedRef.current
        ? current === "saving"
          ? current
          : "saved"
        : "dirty",
    );
  };
  const markDirtyRef = useRef(markDirty);
  markDirtyRef.current = markDirty;
  useEffect(() => {
    const subscription = form.store.subscribe(() => markDirtyRef.current());
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => markDirtyRef.current(), [fields]);
  // Trailing autosave: two quiet seconds after edits begin, persist.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void persistRef.current(), 2000);
    return () => window.clearTimeout(timer);
  }, [saveState]);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saveStateRef.current === "saved") return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
            <Link to="/admin/forms">
              <ArrowLeftIcon /> Back to forms
            </Link>
          </Button>
          <h1 className="mt-2 text-lg font-semibold">Edit submission form</h1>
          <p className="text-sm text-muted-foreground">{form.state.values.internalName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={publicPath} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> View form
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator.clipboard.writeText(`${window.location.origin}${publicPath}`)
            }
          >
            <ClipboardIcon /> Copy link
          </Button>
          <span
            className="text-xs text-muted-foreground tabular-nums"
            role="status"
            aria-live="polite"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "dirty"
                ? "Unsaved changes"
                : saveState === "error"
                  ? "Save failed"
                  : "Saved"}
          </span>
          <Button size="sm" onClick={() => void persist()}>
            <SaveIcon /> Save
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,760px)]">
        <nav className="grid gap-1 lg:sticky lg:top-16">
          <p className="mb-1 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Form setup
          </p>
          {steps.map(([title, description], index) => (
            <button
              key={title}
              type="button"
              className={cn(
                "flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 text-left",
                step === index
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => changeStep(index)}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]">
                {index < step ? <CheckIcon className="size-3" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium">{title}</span>
                <span className="block truncate text-[11px] opacity-70">{description}</span>
              </span>
            </button>
          ))}
        </nav>
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-sm">{steps[step]?.[0]}</CardTitle>
            <p className="text-xs text-muted-foreground">{steps[step]?.[1]}</p>
          </CardHeader>
          <CardContent className="grid gap-5 p-4">
            {step === 0 ? (
              <>
                <form.Field name="kind">
                  {(field) => (
                    <Field>
                      <FieldLabel>What do you want to collect?</FieldLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(["abstract", "session"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            className={cn(
                              "rounded-md border p-4 text-left",
                              field.state.value === kind && "border-primary ring-1 ring-primary",
                            )}
                            onClick={() => field.handleChange(kind)}
                          >
                            <span className="font-medium capitalize">{kind}s</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {kind === "abstract"
                                ? "Collect proposals for review."
                                : "Collect complete session details."}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                </form.Field>
                <form.Field name="collectParticipants">
                  {(field) => (
                    <label className="flex items-center justify-between rounded-md border p-3">
                      <span>
                        <span className="block font-medium">Collect participants</span>
                        <span className="text-xs text-muted-foreground">
                          Add a participant step to the public form.
                        </span>
                      </span>
                      <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                    </label>
                  )}
                </form.Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field name="internalName">
                    {(field) => (
                      <Field>
                        <FieldLabel>Internal name</FieldLabel>
                        <Input
                          required
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="externalTitle">
                    {(field) => (
                      <Field>
                        <FieldLabel>External title</FieldLabel>
                        <Input
                          required
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="welcomeHeading">
                    {(field) => (
                      <Field className="sm:col-span-2">
                        <div className="flex justify-between">
                          <FieldLabel>Page heading</FieldLabel>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {field.state.value.length}/15
                          </span>
                        </div>
                        <Input
                          required
                          maxLength={15}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <form.Field name="showWelcome">
                  {(field) => (
                    <label className="flex items-center justify-between rounded-md border p-3">
                      <span>
                        <span className="block font-medium">Show welcome message</span>
                        <span className="text-xs text-muted-foreground">
                          Display the introduction before account sign-in.
                        </span>
                      </span>
                      <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                    </label>
                  )}
                </form.Field>
                <form.Field name="welcomeMessage">
                  {(field) => (
                    <Field>
                      <FieldLabel>Welcome message</FieldLabel>
                      <RichTextEditor value={field.state.value} onChange={field.handleChange} />
                    </Field>
                  )}
                </form.Field>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <form.Field name="abstractSection">
                  {(field) => (
                    <SectionSettings value={field.state.value} onChange={field.handleChange} />
                  )}
                </form.Field>
                <FormFieldBuilder
                  section="abstract"
                  fields={fields}
                  timezone={eventTimezone}
                  library={data.library}
                  onChange={setFields}
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <form.Field name="participantSection">
                  {(field) => (
                    <SectionSettings value={field.state.value} onChange={field.handleChange} />
                  )}
                </form.Field>
                <div className="rounded-md border p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <UsersIcon className="size-4" />
                    <span className="font-medium">Participant roles</span>
                  </div>
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_90px_90px]">
                    <form.Field name="participantRoles[0].enabled">
                      {(field) => (
                        <label className="flex h-9 items-center justify-between rounded-md border px-3">
                          <span>Speaker</span>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </label>
                      )}
                    </form.Field>
                    <form.Field name="participantRoles[0].min">
                      {(field) => (
                        <Field>
                          <FieldLabel>Min</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="participantRoles[0].max">
                      {(field) => (
                        <Field>
                          <FieldLabel>Max</FieldLabel>
                          <Input
                            type="number"
                            min={1}
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </div>
                <FormFieldBuilder
                  section="participant"
                  fields={fields}
                  timezone={eventTimezone}
                  library={data.library}
                  onChange={setFields}
                />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field name="closeDate">
                    {(field) => (
                      <Field>
                        <FieldLabel>Close date</FieldLabel>
                        <DateTimePicker
                          value={field.state.value}
                          timezone={eventTimezone}
                          onChange={field.handleChange}
                        />
                        <FieldDescription>Uses {eventTimezone}.</FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="submissionLimit">
                    {(field) => (
                      <Field>
                        <div className="flex items-center justify-between">
                          <FieldLabel>Submission limit override</FieldLabel>
                          <Badge variant="secondary">Event default: {eventLimit}</Badge>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          placeholder={String(eventLimit)}
                          value={field.state.value ?? ""}
                          onChange={(event) =>
                            field.handleChange(event.target.valueAsNumber || null)
                          }
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <form.Field name="allowMultipleDrafts">
                    {(field) => (
                      <ToggleRow
                        label="Allow multiple drafts"
                        checked={field.state.value}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="autoRedirectPortal">
                    {(field) => (
                      <ToggleRow
                        label="Auto-redirect to portal after 10s"
                        checked={field.state.value}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="status">
                    {(field) => (
                      <ToggleRow
                        label="Form open"
                        checked={field.state.value === "open"}
                        onChange={(open) => field.handleChange(open ? "open" : "closed")}
                      />
                    )}
                  </form.Field>
                </div>
                <form.Field name="successMessage">
                  {(field) => (
                    <Field>
                      <FieldLabel>Success message</FieldLabel>
                      <FieldDescription>
                        This exact message appears on the confirmation page.
                      </FieldDescription>
                      <RichTextEditor value={field.state.value} onChange={field.handleChange} />
                    </Field>
                  )}
                </form.Field>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <form.Field name="confirmationEmailEnabled">
                  {(field) => (
                    <ToggleRow
                      label="Send submitter confirmation"
                      checked={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
                <form.Field name="confirmationEmailBody">
                  {(field) => (
                    <Field>
                      <FieldLabel>Confirmation email body</FieldLabel>
                      <FieldDescription>
                        Available placeholders: {"{{name}}"}, {"{{title}}"}, {"{{portal_link}}"}
                      </FieldDescription>
                      <RichTextEditor value={field.state.value} onChange={field.handleChange} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="adminAlertUserIds">
                  {(field) => (
                    <Field>
                      <FieldLabel>Admin-alert recipients</FieldLabel>
                      <FieldDescription>Recorded now; delivery lands in WP7.</FieldDescription>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.admins.map((admin) => {
                          const checked = field.state.value.includes(admin.id);
                          return (
                            <label
                              key={admin.id}
                              className="flex items-center gap-2 rounded-md border p-2.5"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) =>
                                  field.handleChange(
                                    next
                                      ? [...field.state.value, admin.id]
                                      : field.state.value.filter((id) => id !== admin.id),
                                  )
                                }
                              />
                              <span>
                                <span className="block text-xs font-medium">{admin.name}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {admin.email}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </Field>
                  )}
                </form.Field>
              </>
            ) : null}

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" disabled={step === 0} onClick={() => changeStep(step - 1)}>
                Back
              </Button>
              {step === steps.length - 1 ? (
                <Button onClick={() => void persist()}>Save form</Button>
              ) : (
                <Button onClick={() => changeStep(step + 1)}>Next</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between rounded-md border px-3">
      <span className="text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function SectionSettings({
  value,
  onChange,
}: {
  readonly value: FormSectionSettingsValue;
  readonly onChange: (value: FormSectionSettingsValue) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>Section title</FieldLabel>
        <Input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </Field>
      <Field>
        <div className="flex justify-between">
          <FieldLabel>Page heading</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {value.heading.length}/15
          </span>
        </div>
        <Input
          maxLength={15}
          value={value.heading}
          onChange={(event) => onChange({ ...value, heading: event.target.value })}
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel>Instructions</FieldLabel>
        <Textarea
          rows={3}
          value={value.instructions}
          onChange={(event) => onChange({ ...value, instructions: event.target.value })}
        />
      </Field>
    </div>
  );
}
