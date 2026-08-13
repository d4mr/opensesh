import type { CommunicationCenter } from "@opensesh/domain";
import { campaignMergeTokens, reminderAlreadyRanInWindow } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  FileTextIcon,
  LoaderCircleIcon,
  MailIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  CampaignEmailPreview,
  DeliveryCountChip,
  SectionLabel,
  campaignAudienceLabel,
  deliveryRollup,
} from "@/components/admin/communications-shared";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SaveStatus } from "@/components/app/save-status";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { cn } from "@/lib/utils";
import type { CommunicationsTab } from "@/routes/admin.communications";
import {
  deleteEmailTemplate,
  runTaskReminderRule,
  saveEmailTemplate,
  saveTaskReminderRule,
} from "@/server-fns/speaker-comms";

const NEW_TEMPLATE_ID = "new";

interface PageProps {
  readonly tab: CommunicationsTab;
  readonly onTabChange: (tab: CommunicationsTab) => void;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}

export function CommunicationsPage(props: PageProps) {
  const context = useAdminEvent();
  if (context === null) return null;
  return (
    <CommunicationsData eventId={context.event.id} timezone={context.event.timezone} {...props} />
  );
}

function CommunicationsData({
  eventId,
  timezone,
  ...props
}: PageProps & { readonly eventId: string; readonly timezone: string }) {
  const result = useSuspenseQuery(communicationCenterQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return (
    <Communications eventId={eventId} timezone={timezone} data={result.data.data} {...props} />
  );
}

function Communications({
  eventId,
  timezone,
  data,
  tab,
  onTabChange,
  spotlightId,
  onSpotlightChange,
}: PageProps & {
  readonly eventId: string;
  readonly timezone: string;
  readonly data: CommunicationCenter;
}) {
  const navigate = useNavigate();
  // The spotlight only ever holds a template (campaign detail is a page, not
  // a panel), so an open spotlight pins the Templates tab regardless of the
  // URL's tab value.
  const activeTab = spotlightId === undefined ? tab : "templates";
  const campaignPages = usePagination(data.campaigns);
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={[
          ...data.templates.map((template) => template.id),
          ...(spotlightId === NEW_TEMPLATE_ID ? [NEW_TEMPLATE_ID] : []),
        ]}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div
            ref={scrollRef}
            className="@container flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:p-6"
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Communications</h1>
                <p className="text-xs text-muted-foreground">
                  Campaigns, automated reminders, and reusable templates.
                </p>
              </div>
              <Button size="sm" className="pressable" asChild>
                <Link
                  to="/admin/communications/new"
                  search={{ audience: undefined, from: undefined }}
                >
                  <PlusIcon /> New campaign
                </Link>
              </Button>
            </div>

            <StatCards data={data} />

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (value === "campaigns" || value === "reminders" || value === "templates")
                  onTabChange(value);
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList variant="line">
                <TabsTrigger value="campaigns">Campaigns ({data.campaigns.length})</TabsTrigger>
                <TabsTrigger value="reminders">Reminders</TabsTrigger>
                <TabsTrigger value="templates">Templates ({data.templates.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns" className="min-h-0 pt-3">
                {data.campaigns.length === 0 ? (
                  <AdminEmptyState
                    icon={MailIcon}
                    title="Send your first campaign"
                    description="A campaign records exactly what each recipient received and how delivery went."
                    action={
                      <Button size="sm" className="pressable" asChild>
                        <Link
                          to="/admin/communications/new"
                          search={{ audience: undefined, from: undefined }}
                        >
                          <PlusIcon /> New campaign
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <TableShell
                    footer={
                      <PaginationFooter
                        page={campaignPages.page}
                        pageSize={campaignPages.pageSize}
                        total={data.campaigns.length}
                        onPageChange={campaignPages.setPage}
                      />
                    }
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          {compact ? null : <TableHead>Audience</TableHead>}
                          <TableHead className="text-right">Recipients</TableHead>
                          <TableHead>Delivery</TableHead>
                          <TableHead className="text-right">Sent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaignPages.pageItems.map((entry) => {
                          const rollup = deliveryRollup(entry.recipients);
                          return (
                            <TableRow
                              key={entry.campaign.id}
                              className="h-9 cursor-pointer"
                              onClick={() =>
                                void navigate({
                                  to: "/admin/communications/$campaignId",
                                  params: { campaignId: entry.campaign.id },
                                  search: { spotlight: undefined },
                                })
                              }
                            >
                              <TableCell className="max-w-64">
                                <p className="truncate font-medium">
                                  {entry.campaign.subjectSnapshot}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {entry.templateName ?? "Custom message"}
                                </p>
                              </TableCell>
                              {compact ? null : (
                                <TableCell className="text-muted-foreground">
                                  {campaignAudienceLabel(entry.campaign)}
                                </TableCell>
                              )}
                              <TableCell className="text-right tabular-nums">
                                {entry.recipients.length}
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-1.5">
                                  {rollup.sent > 0 ? (
                                    <DeliveryCountChip bucket="sent" count={rollup.sent} />
                                  ) : null}
                                  {rollup.queued > 0 ? (
                                    <DeliveryCountChip bucket="queued" count={rollup.queued} />
                                  ) : null}
                                  {rollup.failed > 0 ? (
                                    <DeliveryCountChip bucket="failed" count={rollup.failed} />
                                  ) : null}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.campaign.sentAt === null ? (
                                  <span className="text-xs text-[var(--status-pending)]">
                                    Sending…
                                  </span>
                                ) : (
                                  <Timestamp
                                    value={entry.campaign.sentAt}
                                    timezone={timezone}
                                    className="text-xs text-muted-foreground"
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableShell>
                )}
              </TabsContent>

              <TabsContent value="reminders" className="min-h-0 pt-3">
                <ReminderCard
                  eventId={eventId}
                  timezone={timezone}
                  rule={data.reminderRules[0]}
                  dueSoonTasks={data.pending.dueSoonTasks}
                />
              </TabsContent>

              <TabsContent value="templates" className="min-h-0 pt-3">
                {data.templates.length === 0 && spotlightId !== NEW_TEMPLATE_ID ? (
                  <AdminEmptyState
                    icon={FileTextIcon}
                    title="Create a reusable template"
                    description="Templates prefill the campaign composer with a subject and message."
                    action={
                      <Button
                        size="sm"
                        className="pressable"
                        onClick={() => openSpotlight(NEW_TEMPLATE_ID)}
                      >
                        <PlusIcon /> New template
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid max-w-4xl gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Templates prefill the composer — sending always snapshots the final text.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="pressable"
                        onClick={() => openSpotlight(NEW_TEMPLATE_ID)}
                      >
                        <PlusIcon /> New template
                      </Button>
                    </div>
                    <div className="divide-y overflow-hidden rounded-lg border">
                      {data.templates.map((template) => (
                        <button
                          key={template.id}
                          ref={rowRef(template.id)}
                          type="button"
                          className={cn(
                            "pressable-row flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50",
                            rowClassName(template.id),
                          )}
                          onClick={() => openSpotlight(template.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{template.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {template.subjectTemplate}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Updated{" "}
                            <Timestamp
                              value={template.updatedAt}
                              timezone={timezone}
                              className="tabular-nums"
                            />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
        panel={
          // Keyed so the form re-seeds per template — a shared instance would
          // keep the previous template's fields alive.
          <TemplateSpotlight
            key={spotlightId}
            eventId={eventId}
            data={data}
            templateId={spotlightId === NEW_TEMPLATE_ID ? null : (spotlightId ?? null)}
            onCreated={(id) => onSpotlightChange(id, { replace: true, keyboard: false })}
            onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
          />
        }
      />
    </main>
  );
}

function StatCard({
  label,
  value,
  badge,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly badge: ReactNode;
  readonly detail: string;
}) {
  return (
    <Card className="h-full gap-2 bg-gradient-to-t from-primary/5 to-card py-4 shadow-xs transition-colors group-hover/stat:border-foreground/20">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
        <CardAction>{badge}</CardAction>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">{detail}</CardFooter>
    </Card>
  );
}

// The four communication verbs as overview cards: inform decisions, confirm
// speakers, chase tasks, watch delivery. Every card is a click-through to the
// surface where the verb happens.
function StatCards({ data }: { readonly data: CommunicationCenter }) {
  const pending = data.pending;
  const decisions = pending.acceptedNotInformed + pending.declinedNotInformed;
  const decisionParts = [
    ...(pending.acceptedNotInformed > 0
      ? [`${pending.acceptedNotInformed} acceptance${pending.acceptedNotInformed === 1 ? "" : "s"}`]
      : []),
    ...(pending.declinedNotInformed > 0
      ? [`${pending.declinedNotInformed} decline${pending.declinedNotInformed === 1 ? "" : "s"}`]
      : []),
  ];
  const windowDays = data.reminderRules[0]?.daysBeforeDue ?? 7;
  const outboxActive = pending.queued + pending.sending;
  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
      <Link
        to="/admin/submissions"
        search={{ status: "to_inform", spotlight: undefined }}
        className="group/stat block"
      >
        <StatCard
          label="Decisions to send"
          value={String(decisions)}
          badge={
            decisions > 0 ? (
              <Badge variant="outline" className="gap-1">
                <CircleDashedIcon className="text-status-pending" /> Action needed
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CheckCircle2Icon className="text-status-accepted" /> Done
              </Badge>
            )
          }
          detail={decisions > 0 ? decisionParts.join(" · ") : "Every decision delivered"}
        />
      </Link>
      <Link
        to="/admin/communications/new"
        search={{ audience: "awaiting_confirmation", from: undefined }}
        className="group/stat block"
      >
        <StatCard
          label="Awaiting confirmation"
          value={String(pending.awaitingConfirmation)}
          badge={
            pending.awaitingConfirmation > 0 ? (
              <Badge variant="outline" className="gap-1">
                <CircleDashedIcon className="text-status-pending" /> Waiting
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CheckCircle2Icon className="text-status-accepted" /> Confirmed
              </Badge>
            )
          }
          detail={
            pending.awaitingConfirmation > 0
              ? "Nudge them with a campaign"
              : "Every informed speaker confirmed"
          }
        />
      </Link>
      <Link
        to="/admin/communications"
        search={{ tab: "reminders", spotlight: undefined }}
        className="group/stat block"
      >
        <StatCard
          label="Tasks due soon"
          value={String(pending.dueSoonTasks)}
          badge={
            pending.dueSoonTasks > 0 ? (
              <Badge variant="outline" className="gap-1">
                <Clock3Icon className="text-status-pending" /> Due soon
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CheckCircle2Icon className="text-status-accepted" /> Clear
              </Badge>
            )
          }
          detail={
            pending.dueSoonTasks > 0
              ? `Todo tasks due within ${windowDays} day${windowDays === 1 ? "" : "s"}`
              : "Nothing due in the window"
          }
        />
      </Link>
      <Link to="/admin/emails" search={{ email: undefined }} className="group/stat block">
        <StatCard
          label="Outbox"
          value={String(outboxActive > 0 ? outboxActive : pending.sentTotal)}
          badge={
            pending.failed > 0 ? (
              <Badge variant="destructive" className="tabular-nums">
                {pending.failed} failed
              </Badge>
            ) : outboxActive > 0 ? (
              <Badge variant="outline" className="gap-1">
                <LoaderCircleIcon className="animate-spin text-status-pending" /> Sending
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <CheckCircle2Icon className="text-status-accepted" /> Delivered
              </Badge>
            )
          }
          detail={
            outboxActive > 0
              ? `${pending.sending} sending · ${pending.queued} queued`
              : pending.failed > 0
                ? `${pending.failed} failed · ${pending.sentTotal} delivered`
                : pending.sentTotal > 0
                  ? `All delivered · ${pending.sentTotal} sent`
                  : "Nothing sent yet"
          }
        />
      </Link>
    </div>
  );
}

function ReminderCard({
  eventId,
  timezone,
  rule,
  dueSoonTasks,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly rule: CommunicationCenter["reminderRules"][number] | undefined;
  readonly dueSoonTasks: number;
}) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const [days, setDays] = useState(rule?.daysBeforeDue ?? 7);
  const alreadyRan = reminderAlreadyRanInWindow(rule?.lastRunAt ?? null, new Date());
  const save = useMutation({
    mutationFn: (next: { readonly days: number; readonly enabled: boolean }) =>
      saveTaskReminderRule({
        data: { eventId, id: rule?.id ?? null, daysBeforeDue: next.days, enabled: next.enabled },
      }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else await invalidateAfterMutation(queryClient, eventId);
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
      else {
        toast.success(
          `Queued ${result.data.queued} task reminder${result.data.queued === 1 ? "" : "s"}`,
        );
      }
      await invalidateAfterMutation(queryClient, eventId);
    },
  });
  return (
    <section className="max-w-3xl overflow-hidden rounded-lg border">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Clock3Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="reminder-days"
            className="flex flex-wrap items-center gap-x-1.5 gap-y-2 font-medium"
          >
            Email every speaker with an unwaived task due within
            <Input
              id="reminder-days"
              type="number"
              min={0}
              value={days}
              onChange={(event) => setDays(Math.max(0, Number(event.target.value)))}
              onBlur={() => save.mutate({ days, enabled })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="h-7 w-14 px-2 text-center tabular-nums"
            />
            {days === 1 ? "day." : "days."}
          </label>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {rule?.lastRunAt === null || rule?.lastRunAt === undefined ? (
              "Never run"
            ) : (
              <>
                Last ran{" "}
                <Timestamp value={rule.lastRunAt} timezone={timezone} className="tabular-nums" />
              </>
            )}
            {" · "}
            <span className="tabular-nums">{dueSoonTasks}</span> due in the window right now
          </p>
        </div>
        <Switch
          checked={enabled}
          aria-label="Task reminders enabled"
          onCheckedChange={(checked) => {
            setEnabled(checked === true);
            save.mutate({ days, enabled: checked === true });
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          One-off nudges live on the{" "}
          <Link
            to="/admin/$section"
            params={{ section: "tasks" }}
            search={{ spotlight: undefined, fileRequest: undefined }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Tasks board
          </Link>{" "}
          and{" "}
          <Link
            to="/admin/$section"
            params={{ section: "file-requests" }}
            search={{ spotlight: undefined, fileRequest: undefined }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Deliverables
          </Link>
          .
        </p>
        <Button
          size="sm"
          className="pressable"
          disabled={run.isPending || !enabled || dueSoonTasks === 0 || alreadyRan}
          onClick={() => run.mutate()}
        >
          <SendIcon />
          {run.isPending
            ? "Sending…"
            : alreadyRan
              ? "Already ran today"
              : `Send ${dueSoonTasks} reminder${dueSoonTasks === 1 ? "" : "s"} now`}
        </Button>
      </div>
    </section>
  );
}

function TemplateSpotlight({
  eventId,
  data,
  templateId,
  onCreated,
  onClose,
}: {
  readonly eventId: string;
  readonly data: CommunicationCenter;
  readonly templateId: string | null;
  readonly onCreated: (id: string) => void;
  readonly onClose: () => void;
}) {
  const creating = templateId === null;
  const existing = data.templates.find((template) => template.id === templateId);
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deletedRef = useRef(false);
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    subject: existing?.subjectTemplate ?? "",
    body: existing?.bodyTemplate ?? "",
  });
  const formRef = useRef(form);
  formRef.current = form;
  const payloadData = (current: typeof form) => ({
    eventId,
    id: templateId,
    name: current.name,
    subjectTemplate: current.subject,
    bodyTemplate: current.body,
  });
  // Editing autosaves like the task editor; creation stays one explicit act.
  const autosave = useAutosave({
    buildPayload: () => payloadData(formRef.current),
    save: async (payload) => {
      if (deletedRef.current) return { ok: true };
      if (payload.name.trim().length === 0)
        return { ok: false, message: "A template needs a name" };
      if (payload.subjectTemplate.trim().length === 0)
        return { ok: false, message: "A template needs a subject" };
      if (payload.bodyTemplate.trim().length === 0)
        return { ok: false, message: "A template needs a message" };
      const result = await saveEmailTemplate({ data: payload });
      if (!result.ok) return { ok: false, message: result.error.message };
      await invalidateAfterMutation(queryClient, eventId);
      return { ok: true };
    },
    enabled: !creating,
  });
  useEffect(() => autosave.markDirty(), [autosave.markDirty, form]);
  // Closing the spotlight (Escape, j/k, row click) unmounts the panel — flush
  // pending edits instead of dropping them.
  useEffect(() => () => autosave.persist(), [autosave.persist]);
  const create = useMutation({
    mutationFn: () => saveEmailTemplate({ data: payloadData(form) }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Template created");
      await invalidateAfterMutation(queryClient, eventId);
      if (result.data !== undefined) onCreated(result.data.id);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteEmailTemplate({ data: { eventId, id: templateId ?? "" } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      deletedRef.current = true;
      toast.success("Template deleted");
      await invalidateAfterMutation(queryClient, eventId);
      onClose();
    },
  });
  const incomplete =
    form.name.trim() === "" || form.subject.trim() === "" || form.body.trim() === "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={
          <span className="truncate text-sm font-medium">
            {form.name.trim() || (creating ? "New template" : "Untitled template")}
          </span>
        }
        actions={
          creating ? (
            <Button
              type="button"
              size="xs"
              className="pressable"
              disabled={create.isPending || incomplete}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create template"}
            </Button>
          ) : (
            <>
              <SaveStatus state={autosave.state} retry={autosave.persist} />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="pressable"
                aria-label="Delete template"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon />
              </Button>
            </>
          )
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-3xl gap-6 p-4 pb-16 lg:p-6 lg:pb-16">
          <section className="grid gap-3">
            <SectionLabel>Template</SectionLabel>
            <div className="grid gap-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                autoFocus={creating}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="template-body">Message</Label>
                <div className="flex flex-wrap justify-end gap-1">
                  {campaignMergeTokens.map((token) => (
                    <Button
                      key={token}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setForm((current) => ({ ...current, body: `${current.body}{${token}}` }))
                      }
                    >{`{${token}}`}</Button>
                  ))}
                </div>
              </div>
              <Textarea
                id="template-body"
                className="min-h-32"
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported — the message is sent in the event's email frame.
              </p>
            </div>
          </section>
          <section className="grid gap-3">
            <SectionLabel>Preview</SectionLabel>
            <div className="overflow-hidden rounded-lg border">
              <CampaignEmailPreview
                subject={form.subject.trim() === "" ? "Subject" : form.subject}
                body={form.body}
                className="h-[420px]"
              />
            </div>
          </section>
        </div>
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              "{existing?.name}" disappears from the template list. Campaigns already sent keep
              their snapshots.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Deleting…" : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
