import type {
  EventAdmin,
  Form,
  FormField,
  FormFieldReplacement,
  FormSectionSettings as FormSectionSettingsValue,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import {
  BellIcon,
  CheckIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  EyeIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  PanelTopIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { adminEventsQuery } from "@/lib/review-desk-queries";
import { qk } from "@/lib/query-keys";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { EditorHeader } from "@/components/app/editor-header";
import { type EditorFormField, FormFieldBuilder } from "@/components/forms/form-field-builder";
import { FormPreviewSheet } from "@/components/forms/form-preview";
import type { FormRendererLibrary } from "@/components/forms/form-renderer";
import { DateTimePicker } from "@/components/forms/datetime-picker";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { cn } from "@/lib/utils";
import { getFormEditor, saveForm } from "@/server-fns/forms";

const formEditorQuery = (eventId: string, formId: string) =>
  queryOptions({
    queryKey: qk.formEditor(eventId, formId),
    queryFn: () => getFormEditor({ data: { eventId, formId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/forms_/$formId")({
  loader: async ({ context, params }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(formEditorQuery(eventId, params.formId));
    }
  },
  component: FormEditorRoute,
});

const steps = [
  { title: "Setup", description: "Submission type and participants", icon: Settings2Icon },
  { title: "Welcome", description: "Public title and introduction", icon: PanelTopIcon },
  {
    title: "Submission questions",
    description: "Session or abstract fields",
    icon: ListChecksIcon,
  },
  {
    title: "Participant questions",
    description: "Speaker roles and contact fields",
    icon: UsersIcon,
  },
  {
    title: "Settings",
    description: "Deadline, limit, and success page",
    icon: SlidersHorizontalIcon,
  },
  { title: "Notifications", description: "Confirmation and admin alerts", icon: BellIcon },
] as const;

const dateInput = (date: Date | null) => {
  if (date === null) return "";
  return date.toISOString();
};

const editorFields = (
  fields: ReadonlyArray<FormFieldReplacement>,
): ReadonlyArray<EditorFormField> =>
  fields.map((field) => ({
    id: field.id ?? crypto.randomUUID(),
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<ReadonlyArray<EditorFormField>>(() =>
    editorFields(data.fields),
  );
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicPath = `/submit/${eventSlug}/${data.form.id}`;
  const form = useForm({
    defaultValues: {
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
    setSaveError(undefined);
    const result = await saveForm({ data: payload });
    inFlightRef.current = false;
    if (!result.ok) {
      setSaveState("error");
      setSaveError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    await invalidateAfterMutation(queryClient, data.form.eventId);
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
  const copyLink = () => {
    void navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const active = steps[step];

  return (
    <main className="flex min-h-0 flex-1 flex-col text-sm">
      <EditorHeader
        backTo="/admin/forms"
        backLabel="Forms"
        title={
          <form.Subscribe selector={(state) => state.values.internalName}>
            {(internalName) => internalName}
          </form.Subscribe>
        }
        subtitle="Submission form"
      >
        <SaveStatus state={saveState} retry={() => void persist()} />
        <Button
          size="sm"
          variant="ghost"
          className="pressable text-muted-foreground"
          onClick={copyLink}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />} {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="ghost" className="pressable text-muted-foreground" asChild>
          <a href={publicPath} target="_blank" rel="noreferrer">
            <ExternalLinkIcon /> Open
          </a>
        </Button>
        <Button size="sm" className="pressable" onClick={() => setPreviewOpen(true)}>
          <EyeIcon /> Preview
        </Button>
      </EditorHeader>
      <div className="grid items-start gap-6 p-4 lg:grid-cols-[200px_minmax(0,720px)] lg:p-6">
        <nav className="grid gap-0.5 lg:sticky lg:top-16">
          <p className="mb-1.5 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Form setup
          </p>
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "pressable flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors duration-200 [transition-timing-function:var(--ease-out)]",
                step === index
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              onClick={() => changeStep(index)}
            >
              <item.icon className="size-4 shrink-0 opacity-70" />
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </nav>
        <section key={step} className="wizard-step min-w-0">
          <header className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">{active?.title}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{active?.description}</p>
          </header>
          {saveError === undefined ? null : (
            <p role="alert" className="mb-4 text-[13px] text-destructive">
              {saveError}
            </p>
          )}
          <div className="grid gap-5">
            {step === 0 ? (
              <>
                <SettingPanel>
                  <form.Field name="collectParticipants">
                    {(field) => (
                      <SettingRow
                        label="Collect participants"
                        hint="Add a speaker step to the public form"
                      >
                        <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                      </SettingRow>
                    )}
                  </form.Field>
                </SettingPanel>
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
                          className="h-8"
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
                          className="h-8"
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
                          className="h-8"
                          maxLength={15}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
                <SettingPanel>
                  <form.Field name="showWelcome">
                    {(field) => (
                      <SettingRow
                        label="Show welcome message"
                        hint="Display the introduction before account sign-in"
                      >
                        <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                      </SettingRow>
                    )}
                  </form.Field>
                </SettingPanel>
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
                <div>
                  <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Speakers
                  </p>
                  <SettingPanel>
                    <form.Field name="participantRoles[0].enabled">
                      {(field) => (
                        <SettingRow
                          label="Speaker role"
                          hint="Collect speaker details with each submission"
                        >
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </SettingRow>
                      )}
                    </form.Field>
                    <SettingRow label="Speakers per submission" hint="Minimum and maximum">
                      <div className="flex items-center gap-1.5">
                        <form.Field name="participantRoles[0].min">
                          {(field) => (
                            <Input
                              aria-label="Minimum speakers"
                              type="number"
                              min={1}
                              className="h-8 w-14 bg-background text-center"
                              value={field.state.value}
                              onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                            />
                          )}
                        </form.Field>
                        <span className="text-muted-foreground">–</span>
                        <form.Field name="participantRoles[0].max">
                          {(field) => (
                            <Input
                              aria-label="Maximum speakers"
                              type="number"
                              min={1}
                              className="h-8 w-14 bg-background text-center"
                              value={field.state.value}
                              onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                            />
                          )}
                        </form.Field>
                      </div>
                    </SettingRow>
                  </SettingPanel>
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
                        <FieldLabel>Submission limit</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          className="h-8"
                          placeholder={String(eventLimit)}
                          value={field.state.value ?? ""}
                          onChange={(event) =>
                            field.handleChange(event.target.valueAsNumber || null)
                          }
                        />
                        <FieldDescription>
                          Overrides the event default of {eventLimit} per person.
                        </FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                </div>
                <SettingPanel>
                  <form.Field name="status">
                    {(field) => (
                      <SettingRow label="Form open" hint="Accepting new submissions">
                        <Switch
                          checked={field.state.value === "open"}
                          onCheckedChange={(open) => field.handleChange(open ? "open" : "closed")}
                        />
                      </SettingRow>
                    )}
                  </form.Field>
                  <form.Field name="allowMultipleDrafts">
                    {(field) => (
                      <SettingRow
                        label="Allow multiple drafts"
                        hint="Speakers can keep several drafts in progress"
                      >
                        <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                      </SettingRow>
                    )}
                  </form.Field>
                  <form.Field name="autoRedirectPortal">
                    {(field) => (
                      <SettingRow
                        label="Auto-redirect to portal"
                        hint="Send speakers to their portal 10 seconds after submitting"
                      >
                        <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                      </SettingRow>
                    )}
                  </form.Field>
                </SettingPanel>
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
                <SettingPanel>
                  <form.Field name="confirmationEmailEnabled">
                    {(field) => (
                      <SettingRow
                        label="Send submitter confirmation"
                        hint="Email speakers a receipt after they submit"
                      >
                        <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                      </SettingRow>
                    )}
                  </form.Field>
                </SettingPanel>
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
                      <FieldDescription>
                        Choose who hears about each new submission.
                      </FieldDescription>
                      <div className="grid gap-0.5 rounded-lg border p-1.5">
                        {data.admins.map((admin) => {
                          const checked = field.state.value.includes(admin.id);
                          return (
                            <label
                              key={admin.id}
                              className={cn(
                                "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-muted/60",
                                checked && "bg-muted",
                              )}
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
                              <span className="min-w-0">
                                <span className="block text-[13px] font-medium">{admin.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
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
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button
              variant="ghost"
              className="pressable"
              disabled={step === 0}
              onClick={() => changeStep(step - 1)}
            >
              Back
            </Button>
            {step === steps.length - 1 ? (
              <Button variant="outline" className="pressable" onClick={() => setPreviewOpen(true)}>
                <EyeIcon /> Preview the form
              </Button>
            ) : (
              <Button variant="outline" className="pressable" onClick={() => changeStep(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </section>
      </div>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <FormPreviewSheet
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            values={values}
            fields={fields}
            library={data.library}
            timezone={eventTimezone}
            eventLimit={eventLimit}
          />
        )}
      </form.Subscribe>
    </main>
  );
}

// Quiet sync indicator, Linear-style: a small fixed-width annotation that
// never competes with the toolbar buttons. Failure is the only loud state.
function SaveStatus({
  state,
  retry,
}: {
  readonly state: "saved" | "dirty" | "saving" | "error";
  readonly retry: () => void;
}) {
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={retry}
        className="flex items-center gap-1 text-xs font-medium text-destructive"
        role="status"
        aria-live="polite"
      >
        Save failed — retry
      </button>
    );
  }
  return (
    <span
      className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? (
        <LoaderCircleIcon className="size-3 animate-spin" />
      ) : state === "saved" ? (
        <CheckIcon className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
      )}
      {state === "saving" ? "Saving" : state === "saved" ? "Saved" : "Unsaved"}
    </span>
  );
}

function SettingPanel({ children }: { readonly children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted/40 px-4 py-1">{children}</div>;
}

function SettingRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-6 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint === undefined ? null : <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
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
    <div>
      <p className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        Page copy
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Section title</FieldLabel>
          <Input
            className="h-8"
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
            className="h-8"
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
    </div>
  );
}
