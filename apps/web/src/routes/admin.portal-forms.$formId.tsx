import type { FormAnswers, FormFieldDefinition, PortalFormSection } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { FormFieldBuilder } from "@/components/forms/form-field-builder";
import { FormRenderer } from "@/components/forms/form-renderer";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { hasPortalFormListReturn, updatePortalFormReturnId } from "@/lib/portal-form-navigation";
import { adminPortalQuery } from "@/lib/portal-queries";
import { getPortalAdmin, saveAdminPortalForm } from "@/server-fns/portal";

export const Route = createFileRoute("/admin/portal-forms/$formId")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminPortalQuery("evt_aie_nyc_2026")),
  component: PortalFormEditorRoute,
});

type AdminData = Extract<Awaited<ReturnType<typeof getPortalAdmin>>, { readonly ok: true }>["data"];

interface PortalFormDraft {
  readonly name: string;
  readonly title: string;
  readonly targetType: "contact" | "submission";
  readonly sections: ReadonlyArray<PortalFormSection>;
  readonly confirmationEmailEnabled: boolean;
  readonly confirmationEmailBody: string;
}

const draftFor = (form: AdminData["forms"][number] | undefined): PortalFormDraft => ({
  name: form?.name ?? "",
  title: form?.title ?? "",
  targetType: form?.targetType ?? "contact",
  sections: form?.sections ?? [newSection("Your information", "new-portal-section")],
  confirmationEmailEnabled: form?.confirmationEmailEnabled ?? false,
  confirmationEmailBody: form?.confirmationEmailBody ?? "",
});

const newSection = (
  title = "New section",
  id: string = crypto.randomUUID(),
): PortalFormSection => ({
  id,
  title,
  instructions: "",
  fields: [],
});

const signature = (draft: PortalFormDraft) => JSON.stringify(draft);

function PortalFormEditorRoute() {
  const eventContext = useAdminEvent();
  const { formId } = Route.useParams();
  const eventId = eventContext?.event.id ?? "";
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  if (eventContext === null) return null;
  if (!portal.data.ok) return <p className="p-6 text-sm">{portal.data.error.message}</p>;

  const existing = portal.data.data.forms.find((form) => form.id === formId);
  if (formId !== "new" && existing === undefined) {
    return (
      <main className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-sm font-medium">Portal form not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            It may have been removed since this page was opened.
          </p>
          <Button className="pressable mt-3" size="sm" variant="outline" asChild>
            <a href="/admin/portal-forms">Back to portal forms</a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <PortalFormEditorPage
      key={`${eventContext.event.id}-${formId}`}
      eventId={eventContext.event.id}
      timezone={eventContext.event.timezone}
      formId={formId === "new" ? null : formId}
      data={portal.data.data}
      initialDraft={draftFor(existing)}
    />
  );
}

function PortalFormEditorPage({
  eventId,
  timezone,
  formId,
  data,
  initialDraft,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly formId: string | null;
  readonly data: AdminData;
  readonly initialDraft: PortalFormDraft;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialDraft);
  const [savedSignature, setSavedSignature] = useState(() => signature(initialDraft));
  const [previewAnswers, setPreviewAnswers] = useState<FormAnswers>({});
  const dirty = signature(draft) !== savedSignature;
  const valid = draft.name.trim().length > 0 && draft.title.trim().length > 0;
  const fields = draft.sections.flatMap((section) => section.fields);

  const save = useMutation({
    mutationFn: (next: PortalFormDraft) =>
      saveAdminPortalForm({
        data: {
          eventId,
          id: formId,
          name: next.name,
          title: next.title,
          targetType: next.targetType,
          sections: next.sections,
          confirmationEmailEnabled: next.confirmationEmailEnabled,
          confirmationEmailBody: next.confirmationEmailBody || null,
        },
      }),
    onSuccess: async (result, submitted) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const saved = result.data;
      if (saved === undefined) {
        toast.error("Portal form could not be saved");
        return;
      }
      setSavedSignature(signature(submitted));
      await queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
      toast.success("Portal form saved");
      if (formId === null) {
        updatePortalFormReturnId(eventId, saved.id);
        await navigate({
          to: "/admin/portal-forms/$formId",
          params: { formId: saved.id },
          replace: true,
        });
      }
    },
  });

  const backToList = () => {
    if (hasPortalFormListReturn(eventId)) {
      window.history.back();
      return;
    }
    void navigate({
      to: "/admin/$section",
      params: { section: "portal-forms" },
      search: { spotlight: undefined },
    });
  };
  const updateSection = (id: string, update: Partial<PortalFormSection>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...update } : section,
      ),
    }));
  const moveSection = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= draft.sections.length) return;
    const next = [...draft.sections];
    const current = next[index];
    const target = next[nextIndex];
    if (current === undefined || target === undefined) return;
    next[index] = target;
    next[nextIndex] = current;
    setDraft({ ...draft, sections: next });
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col text-sm">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="pressable -ml-1"
          onClick={backToList}
        >
          <ArrowLeftIcon /> Portal forms
        </Button>
        <div className="min-w-0 border-l pl-3">
          <span className="block truncate text-xs font-medium">
            {draft.name.trim() || "Untitled form"}
          </span>
          <span className="block text-[11px] leading-3 text-muted-foreground">Portal form</span>
        </div>
        <Button
          type="button"
          size="sm"
          className="pressable ml-auto"
          disabled={!dirty || !valid || save.isPending}
          onClick={() => save.mutate(draft)}
        >
          <SaveIcon /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(32rem,3fr)_minmax(24rem,2fr)]">
        <div className="min-w-0 overflow-y-auto">
          <div className="mx-auto grid max-w-3xl gap-6 p-4 lg:p-6">
            <section>
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Form details
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="portal-form-name">Internal name</Label>
                  <Input
                    id="portal-form-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="portal-form-title">Public title</Label>
                  <Input
                    id="portal-form-title"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2 sm:max-w-xs">
                  <Label htmlFor="portal-form-scope">Response scope</Label>
                  <Select
                    value={draft.targetType}
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        targetType: value === "submission" ? "submission" : "contact",
                      })
                    }
                  >
                    <SelectTrigger id="portal-form-scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">Contact</SelectItem>
                      <SelectItem value="submission">Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                    Sections
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Descriptions and questions appear in this order.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {draft.sections.length} {draft.sections.length === 1 ? "section" : "sections"}
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {draft.sections.map((section, index) => (
                  <div key={section.id} className="overflow-hidden rounded-lg border">
                    <div className="flex h-10 items-center gap-2 border-b bg-muted/40 pl-3 pr-1.5">
                      <span className="text-[13px] font-medium tabular-nums">
                        Section {index + 1}
                      </span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="pressable"
                          aria-label={`Move ${section.title} up`}
                          disabled={index === 0}
                          onClick={() => moveSection(index, -1)}
                        >
                          <ChevronUpIcon />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="pressable"
                          aria-label={`Move ${section.title} down`}
                          disabled={index === draft.sections.length - 1}
                          onClick={() => moveSection(index, 1)}
                        >
                          <ChevronDownIcon />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="pressable text-destructive hover:text-destructive"
                          aria-label={`Remove ${section.title}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.filter((item) => item.id !== section.id),
                            })
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 p-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${section.id}-title`}>Section title</Label>
                        <Input
                          id={`${section.id}-title`}
                          value={section.title}
                          onChange={(event) =>
                            updateSection(section.id, { title: event.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Description</Label>
                        <RichTextEditor
                          value={section.instructions}
                          onChange={(instructions) => updateSection(section.id, { instructions })}
                        />
                      </div>
                      <FormFieldBuilder
                        section="abstract"
                        timezone={timezone}
                        library={data.library}
                        fields={section.fields.map((field) => ({
                          ...field,
                          section: "abstract" as const,
                        }))}
                        onChange={(nextFields) =>
                          updateSection(section.id, {
                            fields: nextFields.map(({ section: _section, ...field }) => ({
                              ...field,
                              id: field.id ?? crypto.randomUUID(),
                            })) as ReadonlyArray<FormFieldDefinition>,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="pressable w-fit text-muted-foreground"
                  onClick={() =>
                    setDraft({ ...draft, sections: [...draft.sections, newSection()] })
                  }
                >
                  <PlusIcon /> Add section
                </Button>
              </div>
            </section>

            <section>
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Confirmation
              </p>
              <label className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Send confirmation email</span>
                  <span className="block text-xs text-muted-foreground">
                    Email speakers after they submit this form.
                  </span>
                </span>
                <Switch
                  checked={draft.confirmationEmailEnabled}
                  onCheckedChange={(confirmationEmailEnabled) =>
                    setDraft({ ...draft, confirmationEmailEnabled })
                  }
                />
              </label>
              {draft.confirmationEmailEnabled ? (
                <div className="conditional-field conditional-field-visible mt-3">
                  <div className="grid min-h-0 gap-1.5 overflow-hidden">
                    <Label>Email body</Label>
                    <RichTextEditor
                      value={draft.confirmationEmailBody}
                      onChange={(confirmationEmailBody) =>
                        setDraft({ ...draft, confirmationEmailBody })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <aside className="min-w-0 overflow-y-auto border-l bg-muted/20">
          <div className="sticky top-0 z-10 flex h-9 items-center border-b bg-background/95 px-3 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground">Preview — what speakers see</span>
          </div>
          <div className="mx-auto max-w-xl p-4 lg:p-6">
            <div className="rounded-lg border bg-background p-4">
              <h2 className="text-lg font-semibold tracking-tight">
                {draft.title.trim() || "Untitled form"}
              </h2>
              {draft.sections.map((section) => (
                <div key={section.id} className="mt-2">
                  {section.title.trim().length === 0 ? null : (
                    <p className="text-sm font-medium">{section.title}</p>
                  )}
                  {section.instructions.length === 0 ? null : (
                    <div
                      className="rte-content mt-1 text-xs text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: section.instructions }}
                    />
                  )}
                </div>
              ))}
              {fields.length === 0 ? (
                <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
                  Add a question to see the form fields here.
                </p>
              ) : (
                <FormRenderer
                  className="mt-5"
                  fields={fields}
                  timezone={timezone}
                  library={data.library}
                  answers={previewAnswers}
                  onAnswersChange={setPreviewAnswers}
                  onContinue={() => undefined}
                  continueLabel="Submit response"
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
