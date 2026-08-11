import type { CrmContactDetailView, CrmWorkspace, OrganizationContact } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Timestamp } from "@/components/app/timestamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crmContactQuery, crmWorkspaceQuery } from "@/lib/crm-queries";
import {
  addCrmContactToEvent,
  addCrmNote,
  addCrmTag,
  removeCrmTag,
  saveCrmContact,
} from "@/server-fns/crm";

export function ContactDetail({
  id,
  workspace,
  close,
}: {
  readonly id: string;
  readonly workspace: CrmWorkspace;
  readonly close: () => void;
}) {
  const result = useSuspenseQuery(crmContactQuery(id));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return <ContactDetailContent detail={result.data.data} workspace={workspace} close={close} />;
}

function ContactDetailContent({
  detail,
  workspace,
  close,
}: {
  readonly detail: CrmContactDetailView;
  readonly workspace: CrmWorkspace;
  readonly close: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [eventId, setEventId] = useState(workspace.events[0]?.id ?? "");
  const [participation, setParticipation] = useState<"speaker" | "organizer">("speaker");
  const [editOpen, setEditOpen] = useState(false);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: crmContactQuery(detail.contact.id).queryKey }),
      queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey }),
    ]);
  };
  const noteMutation = useMutation({
    mutationFn: () =>
      addCrmNote({ data: { organizationContactId: detail.contact.id, body: note } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      setNote("");
      toast.success("Internal note saved");
      await refresh();
    },
  });
  const tagMutation = useMutation({
    mutationFn: () => addCrmTag({ data: { organizationContactId: detail.contact.id, name: tag } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      setTag("");
      toast.success(`Added tag ${result.data.name}`);
      await refresh();
    },
  });
  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      removeCrmTag({ data: { organizationContactId: detail.contact.id, tagId } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Tag removed");
      await refresh();
    },
  });
  const addEvent = useMutation({
    mutationFn: () =>
      addCrmContactToEvent({
        data: { organizationContactId: detail.contact.id, eventId, participation },
      }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      const event = workspace.events.find((item) => item.id === result.data.eventId);
      toast.success(`Added to ${event?.name ?? "event"} without duplicate entry`);
      await refresh();
    },
  });
  const currentStage = workspace.pipeline.columns.find(
    (column) => column.stage.id === detail.card?.stageId,
  )?.stage;
  const activity = useMemo(
    () =>
      [
        ...detail.notes.map((item) => ({
          key: `note-${item.note.id}`,
          date: item.note.createdAt,
          title: `Note by ${item.authorName}`,
          detail: item.note.body,
        })),
        ...detail.stageHistory.map((item) => ({
          key: `stage-${item.history.id}`,
          date: item.history.createdAt,
          title: `${item.actorName} moved pipeline stage`,
          detail: `${item.fromStageName ?? "Not in pipeline"} → ${item.toStageName}`,
        })),
        ...detail.events.map((item) => ({
          key: `event-${item.link.id}`,
          date: item.link.createdAt,
          title: `Added to ${item.name}`,
          detail: `${item.link.role} · ${item.link.status}`,
        })),
      ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [detail],
  );
  const communications = workspace.campaigns.flatMap((campaign) =>
    campaign.recipients
      .filter((recipient) => recipient.email === detail.contact.email)
      .map((recipient) => ({ campaign, recipient })),
  );
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 text-sm lg:p-6">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {detail.contact.headshotUrl === null ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-medium">
              {detail.contact.firstName[0]}
              {detail.contact.lastName[0]}
            </span>
          ) : (
            <img
              src={detail.contact.headshotUrl}
              alt={`${detail.contact.firstName} ${detail.contact.lastName}`}
              className="size-11 rounded-full border object-cover"
            />
          )}
          <div>
            <Button variant="ghost" size="xs" className="-ml-2 mb-1 pressable" onClick={close}>
              <ArrowLeftIcon /> Directory
            </Button>
            <h1 className="text-xl font-semibold tracking-tight">
              {detail.contact.firstName} {detail.contact.lastName}
            </h1>
            <p className="text-xs text-muted-foreground">
              Canonical organization contact · {detail.contact.email}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="pressable" onClick={() => setEditOpen(true)}>
          <PencilIcon /> Edit profile & metadata
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid content-start gap-4">
          <section className="rounded-lg border">
            <SectionHeader title="Identity" detail="Canonical across every event" />
            <dl className="divide-y">
              {[
                ["Title", detail.contact.title ?? "—"],
                ["Company", detail.contact.company ?? "—"],
                ["Email", detail.contact.email],
                ["Bio", detail.contact.bio ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t px-3 py-2">
              {[
                ["LinkedIn", detail.contact.linkedinUrl],
                ["Twitter", detail.contact.twitterUrl],
                ["Facebook", detail.contact.facebookUrl],
                ["Website", detail.contact.websiteUrl],
              ].flatMap(([label, value]) =>
                value === null
                  ? []
                  : [
                      value.startsWith("http") ? (
                        <a
                          key={label}
                          className="inline-flex items-center gap-1 text-xs underline underline-offset-4"
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {label}
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      ) : (
                        <Badge key={label} variant="outline">
                          {label}: {value}
                        </Badge>
                      ),
                    ],
              )}
              {detail.contact.linkedinUrl === null &&
              detail.contact.twitterUrl === null &&
              detail.contact.websiteUrl === null ? (
                <span className="text-xs text-muted-foreground">No social links</span>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border">
            <SectionHeader
              title="Tags & custom metadata"
              detail={`${detail.tags.length} tags · ${Object.keys(detail.contact.custom).length} custom fields`}
            />
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {detail.tags.map((item) => (
                <Badge key={item.id} variant="secondary" className="gap-1">
                  {item.name}
                  <button
                    type="button"
                    className="pressable"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeTagMutation.mutate(item.id)}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
              {detail.tags.length === 0 ? (
                <span className="text-xs text-muted-foreground">No tags yet</span>
              ) : null}
            </div>
            <div className="flex gap-2 border-b px-3 py-2">
              <Input
                className="h-8"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                placeholder="Add a tag…"
              />
              <Button
                size="sm"
                variant="outline"
                className="pressable"
                disabled={tagMutation.isPending}
                onClick={() => tagMutation.mutate()}
              >
                <TagIcon /> Add tag
              </Button>
            </div>
            <dl className="divide-y">
              {Object.entries(detail.contact.custom).length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">
                  No custom metadata. Add typed values from Edit profile & metadata.
                </div>
              ) : (
                Object.entries(detail.contact.custom).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[140px_1fr] px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{key}</dt>
                    <dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd>
                  </div>
                ))
              )}
            </dl>
          </section>

          <section className="rounded-lg border">
            <SectionHeader
              title="Events & sessions"
              detail={`${detail.events.length} linked events`}
            />
            <div className="flex gap-2 border-b px-3 py-2">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger size="sm" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspace.events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={participation}
                onValueChange={(value) =>
                  setParticipation(value === "organizer" ? "organizer" : "speaker")
                }
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="speaker">Speaker</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="pressable"
                disabled={addEvent.isPending}
                onClick={() => addEvent.mutate()}
              >
                <CalendarPlusIcon /> Add to event
              </Button>
            </div>
            <div className="divide-y">
              {detail.events.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Not linked to an event yet.
                </p>
              ) : (
                detail.events.map((event) => (
                  <div key={event.link.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{event.name}</p>
                      <Badge variant="outline">{event.link.status}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Added <Timestamp value={event.link.createdAt} />
                      </span>
                    </div>
                    {event.sessions.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">No linked sessions</p>
                    ) : (
                      <div className="mt-2 grid gap-1">
                        {event.sessions.map((session) => (
                          <div key={session.id} className="flex items-center gap-2 text-xs">
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {session.code}
                            </span>
                            <span>{session.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section className="rounded-lg border">
            <SectionHeader
              title="Internal notes"
              detail={`${detail.notes.length} notes · newest first`}
            />
            <div className="grid gap-2 border-b p-3">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Add context for the team…"
              />
              <Button
                size="sm"
                className="ml-auto pressable"
                disabled={noteMutation.isPending}
                onClick={() => noteMutation.mutate()}
              >
                <PlusIcon /> Save note
              </Button>
            </div>
            <div className="max-h-72 divide-y overflow-auto">
              {detail.notes.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No internal notes yet.
                </p>
              ) : (
                detail.notes.map((item) => (
                  <article key={item.note.id} className="px-3 py-2.5">
                    <p className="whitespace-pre-wrap">{item.note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.authorName} · <Timestamp value={item.note.createdAt} />
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border">
            <SectionHeader
              title="Pipeline"
              detail={
                currentStage === undefined
                  ? "Not sourced"
                  : `${currentStage.name} · ${currentStage.semanticStatus}`
              }
            />
            {detail.card?.note === null || detail.card === null ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {detail.card === null ? "Add this contact from the Pipeline tab." : "No card note."}
              </p>
            ) : (
              <p className="px-3 py-3">{detail.card.note}</p>
            )}
            <div className="divide-y border-t">
              {detail.stageHistory.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">No transitions recorded.</p>
              ) : (
                detail.stageHistory.map((item) => (
                  <div key={item.history.id} className="px-3 py-2">
                    <p className="text-xs">
                      <span className="font-medium">{item.actorName}</span> ·{" "}
                      {item.fromStageName ?? "Not in pipeline"} → {item.toStageName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <Timestamp value={item.history.createdAt} />
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border">
            <SectionHeader
              title="Communication history"
              detail={`${communications.length} campaign deliveries`}
            />
            <div className="divide-y">
              {communications.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  No CRM campaigns sent to this contact.
                </p>
              ) : (
                communications.map(({ campaign, recipient }) => (
                  <div key={recipient.id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MailIcon className="size-3.5" />
                      <p className="font-medium">{recipient.resolvedSubject}</p>
                      <Badge variant="outline" className="ml-auto">
                        {recipient.deliveryStatus}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.eventName} ·{" "}
                      {campaign.sentAt === null ? "Draft" : <Timestamp value={campaign.sentAt} />}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border">
            <SectionHeader title="Activity" detail={`${activity.length} chronological entries`} />
            <div className="max-h-80 divide-y overflow-auto">
              {activity.map((item) => (
                <div key={item.key} className="flex gap-2 px-3 py-2.5">
                  <HistoryIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      <Timestamp value={item.date} />
                    </p>
                  </div>
                </div>
              ))}
              {activity.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  Activity appears as this contact is used.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
      <ProfileEditor
        contact={detail.contact}
        open={editOpen}
        onOpenChange={setEditOpen}
        saved={refresh}
      />
    </main>
  );
}

function SectionHeader({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <div className="flex h-10 items-center justify-between border-b bg-muted/40 px-3">
      <h2 className="text-[13px] font-medium">{title}</h2>
      <span className="text-[11px] text-muted-foreground">{detail}</span>
    </div>
  );
}

function ProfileEditor({
  contact,
  open,
  onOpenChange,
  saved,
}: {
  readonly contact: OrganizationContact;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly saved: () => Promise<void>;
}) {
  const [custom, setCustom] = useState(contact.custom);
  const [customKey, setCustomKey] = useState("");
  const [customType, setCustomType] = useState<"text" | "number" | "boolean">("text");
  const [customValue, setCustomValue] = useState("");
  const save = useMutation({
    mutationFn: saveCrmContact,
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Canonical profile saved");
      onOpenChange(false);
      await saved();
    },
  });
  const form = useForm({
    defaultValues: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      title: contact.title ?? "",
      company: contact.company ?? "",
      bio: contact.bio ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      twitterUrl: contact.twitterUrl ?? "",
      websiteUrl: contact.websiteUrl ?? "",
      headshotUrl: contact.headshotUrl ?? "",
    },
    onSubmit: ({ value }) =>
      save.mutate({
        data: {
          id: contact.id,
          ...value,
          title: value.title || null,
          company: value.company || null,
          bio: value.bio || null,
          linkedinUrl: value.linkedinUrl || null,
          twitterUrl: value.twitterUrl || null,
          websiteUrl: value.websiteUrl || null,
          headshotUrl: value.headshotUrl || null,
          facebookUrl: contact.facebookUrl,
          custom,
        },
      }),
  });
  const addCustom = () => {
    const key = customKey.trim();
    if (key.length === 0) return;
    const value =
      customType === "number"
        ? Number(customValue)
        : customType === "boolean"
          ? customValue === "true"
          : customValue;
    if (typeof value === "number" && Number.isNaN(value))
      return toast.error("Enter a valid number");
    setCustom((current) => ({ ...current, [key]: value }));
    setCustomKey("");
    setCustomValue("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit canonical profile</DialogTitle>
          <DialogDescription>
            Changes are reused the next time this contact is added to an event.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {(["firstName", "lastName"] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Field>
                    <FieldLabel>{name === "firstName" ? "First name" : "Last name"}</FieldLabel>
                    <Input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      required
                    />
                  </Field>
                )}
              </form.Field>
            ))}
          </div>
          {(
            [
              "email",
              "title",
              "company",
              "linkedinUrl",
              "twitterUrl",
              "websiteUrl",
              "headshotUrl",
            ] as const
          ).map((name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <Field>
                  <FieldLabel>
                    {name.replace("Url", " URL").replace(/^./, (letter) => letter.toUpperCase())}
                  </FieldLabel>
                  <Input
                    type={name === "email" ? "email" : "text"}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required={name === "email"}
                  />
                </Field>
              )}
            </form.Field>
          ))}
          <form.Field name="bio">
            {(field) => (
              <Field>
                <FieldLabel>Bio</FieldLabel>
                <Textarea
                  rows={4}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <div className="rounded-lg border">
            <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
              Typed custom metadata
            </div>
            <div className="divide-y">
              {Object.entries(custom).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-32 text-xs text-muted-foreground">{key}</span>
                  <span className="flex-1">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove ${key}`}
                    onClick={() =>
                      setCustom((current) =>
                        Object.fromEntries(
                          Object.entries(current).filter(([name]) => name !== key),
                        ),
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_110px_1fr_auto] gap-2 border-t p-2">
              <Input
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="Field name"
              />
              <Select
                value={customType}
                onValueChange={(value) => {
                  if (value === "text" || value === "number" || value === "boolean")
                    setCustomType(value);
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Yes/no</SelectItem>
                </SelectContent>
              </Select>
              {customType === "boolean" ? (
                <Select value={customValue || "false"} onValueChange={setCustomValue}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  placeholder="Value"
                />
              )}
              <Button type="button" size="sm" variant="outline" onClick={addCustom}>
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="pressable" disabled={save.isPending}>
              <FileTextIcon /> Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
