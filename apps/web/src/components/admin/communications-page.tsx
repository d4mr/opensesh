import type {
  CampaignRecipientHistory,
  CommunicationCenter,
  EmailTemplate,
  SpeakerWorkflowStatus,
} from "@opensesh/domain";
import { campaignMergeTokens, resolveMergeFields } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  Clock3Icon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { workflowLabels } from "@/components/admin/speaker-admin-dialogs";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SpeakerPickerDialog } from "@/components/admin/speaker-picker-dialog";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpeakerBadge } from "@/components/app/speaker-badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { communicationCenterQuery } from "@/lib/communication-queries";
import {
  deleteEmailTemplate,
  runTaskReminderRule,
  saveEmailTemplate,
  saveTaskReminderRule,
  sendSpeakerCampaign,
} from "@/server-fns/speaker-comms";

export function CommunicationsPage() {
  const context = useAdminEvent();
  if (context === null) return null;
  return <CommunicationsData eventId={context.event.id} timezone={context.event.timezone} />;
}

function CommunicationsData({
  eventId,
  timezone,
}: {
  readonly eventId: string;
  readonly timezone: string;
}) {
  const result = useSuspenseQuery(communicationCenterQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return <Communications eventId={eventId} timezone={timezone} data={result.data.data} />;
}

type CenterData = CommunicationCenter;

function Communications({
  eventId,
  timezone,
  data,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: CenterData;
}) {
  const queryClient = useQueryClient();
  const [recipientMode, setRecipientMode] = useState<"all" | "status" | "incomplete" | "selected">(
    "all",
  );
  const [status, setStatus] = useState<SpeakerWorkflowStatus>("confirmed");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [templateId, setTemplateId] = useState<string | null>(data.templates[0]?.id ?? null);
  const initialTemplate = data.templates.find((template) => template.id === templateId);
  const [subject, setSubject] = useState(initialTemplate?.subjectTemplate ?? "");
  const [body, setBody] = useState(initialTemplate?.bodyTemplate ?? "");
  const [previewId, setPreviewId] = useState(data.contacts[0]?.id ?? "");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate>();
  const [expandedCampaign, setExpandedCampaign] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const refresh = () => invalidateAfterMutation(queryClient, eventId);
  const recipients = useMemo(
    () =>
      data.contacts.filter((contact) =>
        recipientMode === "all"
          ? true
          : recipientMode === "status"
            ? contact.workflowStatus === status
            : recipientMode === "incomplete"
              ? contact.taskIncomplete > 0
              : selectedIds.has(contact.id),
      ),
    [data.contacts, recipientMode, selectedIds, status],
  );
  const preview = data.contacts.find((contact) => contact.id === previewId) ?? recipients[0];
  const fields =
    preview === undefined
      ? { speaker_name: "", talk_title: "", event_name: data.eventName, portal_url: "/portal" }
      : {
          speaker_name: `${preview.firstName} ${preview.lastName}`,
          talk_title: preview.talkTitle,
          event_name: data.eventName,
          portal_url: "/portal",
        };
  const send = useMutation({
    mutationFn: () =>
      sendSpeakerCampaign({
        data: {
          eventId,
          templateId,
          subject,
          body,
          recipientFilter: { mode: recipientMode, status },
          contactIds: recipients.map((recipient) => recipient.id),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.failed > 0) toast.error(`${result.data.failed} campaign emails failed`);
      else
        toast.success(
          `Sent ${result.data.sent} campaign email${result.data.sent === 1 ? "" : "s"}`,
        );
      await refresh();
    },
  });
  if (data.contacts.length === 0) {
    return (
      <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-5 overflow-hidden p-4 text-sm lg:p-6">
        <div className="shrink-0">
          <h1 className="text-lg font-semibold tracking-tight">Communications</h1>
          <p className="text-xs text-muted-foreground">
            Compose resolved speaker campaigns and automate due-task reminders.
          </p>
        </div>
        <AdminEmptyState
          icon={UsersIcon}
          title="Add speakers before sending a campaign"
          description="Communications become available as soon as your speaker directory has recipients."
          action={
            <Button asChild size="sm" className="pressable">
              <Link to="/admin/speakers" search={{ spotlight: undefined }}>
                Add speakers
              </Link>
            </Button>
          }
        />
      </main>
    );
  }
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-5 overflow-hidden p-4 text-sm lg:p-6">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Communications</h1>
          <p className="text-xs text-muted-foreground">
            Compose resolved speaker campaigns and automate due-task reminders.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingTemplate(undefined);
            setTemplateOpen(true);
          }}
        >
          <PlusIcon /> New template
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <section className="grid shrink-0 gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-medium">Campaign composer</h2>
            <Badge variant="secondary" className="tabular-nums">
              {recipients.length} recipients
            </Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Select
                  value={recipientMode}
                  onValueChange={(value) =>
                    setRecipientMode(
                      value === "status" || value === "incomplete" || value === "selected"
                        ? value
                        : "all",
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All speakers</SelectItem>
                    <SelectItem value="status">By workflow status</SelectItem>
                    <SelectItem value="incomplete">Tasks incomplete</SelectItem>
                    <SelectItem value="selected">Explicit selection</SelectItem>
                  </SelectContent>
                </Select>
                {recipientMode !== "status" ? null : (
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      if (
                        value === "invited" ||
                        value === "onboarding" ||
                        value === "confirmed" ||
                        value === "ready" ||
                        value === "declined"
                      )
                        setStatus(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(workflowLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={templateId ?? "custom"}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setTemplateId(null);
                      return;
                    }
                    const template = data.templates.find((item) => item.id === value);
                    setTemplateId(value);
                    if (template !== undefined) {
                      setSubject(template.subjectTemplate);
                      setBody(template.bodyTemplate);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom message</SelectItem>
                    {data.templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {recipientMode !== "selected" ? null : (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border p-1.5">
                  {recipients.length === 0 ? (
                    <span className="px-1.5 text-xs text-muted-foreground">
                      No speakers selected yet.
                    </span>
                  ) : (
                    <>
                      {recipients.slice(0, 8).map((contact) => (
                        <SpeakerBadge
                          key={contact.id}
                          person={{
                            id: contact.id,
                            name: `${contact.firstName} ${contact.lastName}`,
                            image: contact.headshotUrl,
                          }}
                        />
                      ))}
                      {recipients.length > 8 ? (
                        <span className="px-1 text-xs text-muted-foreground tabular-nums">
                          +{recipients.length - 8} more
                        </span>
                      ) : null}
                    </>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="pressable ml-auto"
                    onClick={() => setPickerOpen(true)}
                  >
                    <UsersIcon />
                    {recipients.length === 0 ? "Choose speakers" : "Edit selection"}
                  </Button>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Message</Label>
                  <div className="flex flex-wrap justify-end gap-1">
                    {campaignMergeTokens.map((token) => (
                      <Button
                        key={token}
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setBody((current) => `${current}{${token}}`)}
                      >{`{${token}}`}</Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-32"
                />
              </div>
            </div>
            <div className="grid content-start gap-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Resolved preview
                </p>
                <Select value={preview?.id ?? ""} onValueChange={setPreviewId}>
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue placeholder="Recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="font-medium">{resolveMergeFields(subject, fields)}</p>
              <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                {resolveMergeFields(body, fields)}
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t pt-3">
            <Button
              disabled={
                send.isPending ||
                recipients.length === 0 ||
                subject.trim() === "" ||
                body.trim() === ""
              }
              onClick={() => send.mutate()}
            >
              <SendIcon /> {send.isPending ? "Sending…" : `Send to ${recipients.length}`}
            </Button>
          </div>
        </section>

        <TemplateList
          eventId={eventId}
          templates={data.templates}
          edit={(template) => {
            setEditingTemplate(template);
            setTemplateOpen(true);
          }}
          refresh={refresh}
        />
        <ReminderSettings
          eventId={eventId}
          timezone={timezone}
          rules={data.reminderRules}
          refresh={refresh}
        />

        <section className="grid gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Campaign history</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.campaigns.length} campaigns
            </span>
          </div>
          <div className="min-w-0 divide-y rounded-lg border">
            {data.campaigns.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                Send a campaign to create history.
              </p>
            ) : (
              data.campaigns.map((entry) => (
                <div key={entry.campaign.id}>
                  <button
                    type="button"
                    className="pressable-row flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() =>
                      setExpandedCampaign((current) =>
                        current === entry.campaign.id ? undefined : entry.campaign.id,
                      )
                    }
                  >
                    <MailIcon className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {entry.campaign.subjectSnapshot}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.templateName ?? "Custom message"}
                      </span>
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      {entry.recipients.length} recipients
                    </Badge>
                    {entry.campaign.sentAt === null ? (
                      <span className="text-xs text-muted-foreground">Draft</span>
                    ) : (
                      <Timestamp
                        value={entry.campaign.sentAt}
                        timezone={timezone}
                        className="text-xs text-muted-foreground"
                      />
                    )}
                    <ChevronDownIcon
                      className={`size-4 ${expandedCampaign === entry.campaign.id ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expandedCampaign !== entry.campaign.id ? null : (
                    <CampaignRecipients recipients={entry.recipients} />
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {templateOpen ? (
        <TemplateDialog
          eventId={eventId}
          template={editingTemplate}
          open
          onOpenChange={setTemplateOpen}
          refresh={refresh}
        />
      ) : null}
      <SpeakerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contacts={data.contacts}
        value={selectedIds}
        onChange={setSelectedIds}
        title="Select recipients"
        description="Search and filter the speaker directory, then pick who receives this campaign."
      />
    </main>
  );
}

function CampaignRecipients({
  recipients,
}: {
  readonly recipients: ReadonlyArray<CampaignRecipientHistory>;
}) {
  const pages = usePagination(recipients);
  return (
    <div className="border-t bg-muted/20 p-2">
      <TableShell
        className="max-h-80 bg-background"
        footer={
          <PaginationFooter
            page={pages.page}
            pageSize={pages.pageSize}
            total={recipients.length}
            onPageChange={pages.setPage}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Resolved subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.pageItems.map((recipient) => (
              <TableRow key={recipient.id}>
                <TableCell>
                  <p>{recipient.contactName}</p>
                  <p className="text-xs text-muted-foreground">{recipient.email}</p>
                </TableCell>
                <TableCell>{recipient.resolvedSubject}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {recipient.emailStatus ?? recipient.deliveryStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}

function TemplateList({
  eventId,
  templates,
  edit,
  refresh,
}: {
  readonly eventId: string;
  readonly templates: ReadonlyArray<EmailTemplate>;
  readonly edit: (template: EmailTemplate) => void;
  readonly refresh: () => Promise<unknown>;
}) {
  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailTemplate({ data: { eventId, id } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else {
        toast.success("Template deleted");
        await refresh();
      }
    },
  });
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Templates</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {templates.length} templates
        </span>
      </div>
      <div className="min-w-0 divide-y rounded-lg border">
        {templates.map((template) => (
          <div key={template.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{template.name}</p>
              <p className="truncate text-xs text-muted-foreground">{template.subjectTemplate}</p>
            </div>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Edit ${template.name}`}
              onClick={() => edit(template)}
            >
              <PencilIcon />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Delete ${template.name}`}
              onClick={() => remove.mutate(template.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateDialog({
  eventId,
  template,
  open,
  onOpenChange,
  refresh,
}: {
  readonly eventId: string;
  readonly template: EmailTemplate | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly refresh: () => Promise<unknown>;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subjectTemplate ?? "");
  const [body, setBody] = useState(template?.bodyTemplate ?? "");
  const mutation = useMutation({
    mutationFn: () =>
      saveEmailTemplate({
        data: {
          eventId,
          id: template?.id ?? null,
          name,
          subjectTemplate: subject,
          bodyTemplate: body,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else {
        toast.success("Template saved");
        await refresh();
        onOpenChange(false);
      }
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {template === undefined ? "New email template" : "Edit email template"}
          </DialogTitle>
          <DialogDescription>
            Supported tokens: {campaignMergeTokens.map((token) => `{${token}}`).join(", ")}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Message</Label>
            <Textarea
              className="min-h-32"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              mutation.isPending ||
              name.trim() === "" ||
              subject.trim() === "" ||
              body.trim() === ""
            }
            onClick={() => mutation.mutate()}
          >
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReminderSettings({
  eventId,
  timezone,
  rules,
  refresh,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly rules: CenterData["reminderRules"];
  readonly refresh: () => Promise<unknown>;
}) {
  const rule = rules[0];
  const [days, setDays] = useState(rule?.daysBeforeDue ?? 3);
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const save = useMutation({
    mutationFn: () =>
      saveTaskReminderRule({
        data: { eventId, id: rule?.id ?? null, daysBeforeDue: days, enabled },
      }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else {
        toast.success("Reminder rule saved");
        await refresh();
      }
    },
  });
  const run = useMutation({
    mutationFn: async () => {
      const saved = await saveTaskReminderRule({
        data: { eventId, id: rule?.id ?? null, daysBeforeDue: days, enabled },
      });
      if (!saved.ok) return saved;
      return runTaskReminderRule({ data: { eventId, id: saved.data.id } });
    },
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else if (!("skippedAsDuplicate" in result.data)) return;
      else if (result.data.skippedAsDuplicate) toast.success("Already ran in this delivery window");
      else
        toast.success(`Sent ${result.data.sent} task reminder${result.data.sent === 1 ? "" : "s"}`);
      await refresh();
    },
  });
  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Clock3Icon className="size-4 text-muted-foreground" />
        <div className="mr-auto">
          <h2 className="text-sm font-medium">Task reminder rule</h2>
          <p className="text-xs text-muted-foreground">
            Incomplete and unwaived assignments due within the delivery window.
          </p>
        </div>
        {rule?.lastRunAt === null || rule?.lastRunAt === undefined ? (
          <span className="text-xs text-muted-foreground">Never run</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Last run{" "}
            <Timestamp value={rule.lastRunAt} timezone={timezone} className="tabular-nums" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <label className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} /> Enabled
        </label>
        <Label htmlFor="reminder-days">Days before due</Label>
        <Input
          id="reminder-days"
          className="h-8 w-20"
          type="number"
          min={0}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        />
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
          Save rule
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          disabled={run.isPending || !enabled}
          onClick={() => run.mutate()}
        >
          <SendIcon /> {run.isPending ? "Running…" : "Run now"}
        </Button>
      </div>
    </section>
  );
}
