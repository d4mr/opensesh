import type { AudienceSegment, CommunicationCenter } from "@opensesh/domain";
import { audienceMemberIds, campaignMergeTokens, resolveMergeFields } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, SendIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  CampaignEmailPreview,
  SectionLabel,
  audienceLabels,
} from "@/components/admin/communications-shared";
import { SpeakerPickerDialog } from "@/components/admin/speaker-picker-dialog";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { sendSpeakerCampaign } from "@/server-fns/speaker-comms";

const segments: ReadonlyArray<AudienceSegment> = [
  "all_speakers",
  "confirmed",
  "awaiting_confirmation",
  "incomplete_tasks",
  "selected",
  "all_submitters",
  "awaiting_decision",
  "declined",
  "selected_submitters",
];

interface ComposerState {
  readonly segment: AudienceSegment;
  readonly selectedIds: ReadonlyArray<string>;
  readonly selectedSubmitterIds: ReadonlyArray<string>;
  readonly templateId: string | null;
  readonly subject: string;
  readonly body: string;
}

const stringIds = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

// No server-side drafts — sending stays one explicit act. The half-written
// campaign survives navigation in localStorage instead, keyed per event.
const draftKey = (eventId: string) => `opensesh:campaign-draft:${eventId}`;

const readDraft = (eventId: string): ComposerState | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(eventId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<ComposerState>;
    return {
      segment: segments.find((segment) => segment === parsed.segment) ?? "all_speakers",
      selectedIds: stringIds(parsed.selectedIds),
      selectedSubmitterIds: stringIds(parsed.selectedSubmitterIds),
      templateId: typeof parsed.templateId === "string" ? parsed.templateId : null,
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
    };
  } catch {
    return null;
  }
};

interface PageProps {
  readonly presetAudience: AudienceSegment | undefined;
  readonly fromCampaignId: string | undefined;
}

export function CampaignComposerPage(props: PageProps) {
  const context = useAdminEvent();
  if (context === null) return null;
  return <ComposerData eventId={context.event.id} {...props} />;
}

function ComposerData({ eventId, ...props }: PageProps & { readonly eventId: string }) {
  const result = useSuspenseQuery(communicationCenterQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return <Composer eventId={eventId} data={result.data.data} {...props} />;
}

function Composer({
  eventId,
  data,
  presetAudience,
  fromCampaignId,
}: PageProps & { readonly eventId: string; readonly data: CommunicationCenter }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Prefill precedence: an explicit source campaign wins, then a preset
  // audience, then defaults — the saved draft only fills a cold start (mount
  // effect below), so a deliberate entry point never loses to stale state.
  const initial = useMemo((): ComposerState => {
    const source = data.campaigns.find((entry) => entry.campaign.id === fromCampaignId);
    if (source !== undefined) {
      const segment =
        segments.find((candidate) => candidate === source.campaign.recipientFilter.segment) ??
        "selected";
      const speakerIds = new Set(data.speakers.map((speaker) => speaker.id));
      const submitterIds = new Set(data.submitters.map((submitter) => submitter.id));
      const recipientIds = source.recipients.map((recipient) => recipient.contactId);
      return {
        segment,
        selectedIds: segment === "selected" ? recipientIds.filter((id) => speakerIds.has(id)) : [],
        selectedSubmitterIds:
          segment === "selected_submitters"
            ? recipientIds.filter((id) => submitterIds.has(id))
            : [],
        templateId: source.campaign.templateId,
        subject: source.campaign.subjectSnapshot,
        body: source.campaign.bodySnapshot,
      };
    }
    return {
      segment: presetAudience ?? "all_speakers",
      selectedIds: [],
      selectedSubmitterIds: [],
      templateId: null,
      subject: "",
      body: "",
    };
  }, [data.campaigns, data.speakers, fromCampaignId, presetAudience]);
  const [state, setState] = useState(initial);
  const [previewId, setPreviewId] = useState("");
  const [picker, setPicker] = useState<"speakers" | "submitters" | null>(null);
  // Draft restore is a client-only act (localStorage), so it happens after
  // hydration — and only on a cold start, never over a deliberate prefill.
  // The write side lives in `update` (user edits only): an effect watching
  // state would race this restore and clobber the draft with defaults.
  useEffect(() => {
    if (fromCampaignId !== undefined || presetAudience !== undefined) return;
    const draft = readDraft(eventId);
    if (draft !== null) setState(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (next: ComposerState) => {
    setState(next);
    window.localStorage.setItem(draftKey(eventId), JSON.stringify(next));
  };
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  // Submitters can also be speakers (submitterhood is a submission fact) —
  // the speaker entry wins so previews resolve talk titles.
  const allContacts = useMemo(() => {
    const speakerIds = new Set(data.speakers.map((speaker) => speaker.id));
    return [
      ...data.speakers,
      ...data.submitters
        .filter((contact) => !speakerIds.has(contact.id))
        .map((contact) => ({
          ...contact,
          title: null,
          company: null,
          pipeline: "added" as const,
          talkTitle: "",
        })),
    ];
  }, [data.speakers, data.submitters]);
  const selectedIds = useMemo(() => new Set(state.selectedIds), [state.selectedIds]);
  const selectedSubmitterIds = useMemo(
    () => new Set(state.selectedSubmitterIds),
    [state.selectedSubmitterIds],
  );
  const activeSelection =
    state.segment === "selected_submitters" ? selectedSubmitterIds : selectedIds;
  const recipientIds = useMemo(
    () => new Set(audienceMemberIds(data, state.segment, activeSelection)),
    [data, state.segment, activeSelection],
  );
  const recipients = useMemo(
    () => allContacts.filter((contact) => recipientIds.has(contact.id)),
    [allContacts, recipientIds],
  );
  const preview = allContacts.find((contact) => contact.id === previewId) ?? recipients[0];
  // Mirror the server's resolution (`${portalOrigin}/portal`) so the preview
  // shows the same absolute URL the sent email will carry.
  const portalUrl = `${typeof window === "undefined" ? "https://app.opensesh.io" : window.location.origin}/portal`;
  const fields =
    preview === undefined
      ? { speaker_name: "", talk_title: "", event_name: data.eventName, portal_url: portalUrl }
      : {
          speaker_name: `${preview.firstName} ${preview.lastName}`,
          talk_title: preview.talkTitle,
          event_name: data.eventName,
          portal_url: portalUrl,
        };
  const resolvedSubject = resolveMergeFields(state.subject, fields);
  const resolvedBody = resolveMergeFields(state.body, fields);
  const segmentCount = (segment: AudienceSegment) =>
    segment === "selected"
      ? selectedIds.size
      : segment === "selected_submitters"
        ? selectedSubmitterIds.size
        : audienceMemberIds(data, segment).length;

  const send = useMutation({
    mutationFn: () =>
      sendSpeakerCampaign({
        data: {
          eventId,
          templateId: state.templateId,
          subject: state.subject,
          body: state.body,
          recipientFilter: { segment: state.segment },
          segment: state.segment,
          contactIds: recipients.map((recipient) => recipient.id),
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      window.localStorage.removeItem(draftKey(eventId));
      toast.success(
        `Queued ${result.data.queued} campaign email${result.data.queued === 1 ? "" : "s"}`,
      );
      await invalidateAfterMutation(queryClient, eventId);
      await navigate({
        to: "/admin/communications/$campaignId",
        params: { campaignId: result.data.campaignId },
        search: { spotlight: undefined },
        replace: true,
      });
    },
  });

  const discard = () => {
    window.localStorage.removeItem(draftKey(eventId));
    setState(initial);
  };

  if (allContacts.length === 0) {
    return (
      <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 p-4 text-sm lg:p-6">
        <AdminEmptyState
          icon={UsersIcon}
          title="Add contacts before sending a campaign"
          description="Campaigns become available when an audience segment has eligible recipients."
          action={
            <Button size="sm" className="pressable" asChild>
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
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <div className="shrink-0 p-4 pb-0 lg:p-6 lg:pb-0">
        <Button variant="ghost" size="xs" asChild className="mb-2 -ml-2">
          <Link to="/admin/communications" search={{ tab: "campaigns", spotlight: undefined }}>
            <ArrowLeftIcon /> Back to communications
          </Link>
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">New campaign</h1>
        <p className="text-xs text-muted-foreground">
          Merge tokens resolve per recipient; delivery flows through the outbox.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:overflow-hidden lg:p-6">
        <div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto lg:pr-1">
          <section className="grid shrink-0 gap-3">
            <SectionLabel>Audience</SectionLabel>
            <Select
              value={state.segment}
              onValueChange={(value) => {
                const segment = segments.find((candidate) => candidate === value);
                if (segment !== undefined) update({ ...state, segment });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Speakers</SelectLabel>
                  {(
                    [
                      "all_speakers",
                      "confirmed",
                      "awaiting_confirmation",
                      "incomplete_tasks",
                      "selected",
                    ] as const
                  ).map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {audienceLabels[segment]} ({segmentCount(segment)})
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Submitters</SelectLabel>
                  {(
                    [
                      "all_submitters",
                      "awaiting_decision",
                      "declined",
                      "selected_submitters",
                    ] as const
                  ).map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {audienceLabels[segment]} ({segmentCount(segment)})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {state.segment !== "selected" && state.segment !== "selected_submitters" ? null : (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border p-1.5">
                {recipients.length === 0 ? (
                  <span className="px-1.5 text-xs text-muted-foreground">
                    No {state.segment === "selected" ? "speakers" : "submitters"} selected yet.
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
                  onClick={() =>
                    setPicker(state.segment === "selected" ? "speakers" : "submitters")
                  }
                >
                  <UsersIcon />
                  {recipients.length === 0
                    ? `Choose ${state.segment === "selected" ? "speakers" : "submitters"}`
                    : "Edit selection"}
                </Button>
              </div>
            )}
          </section>
          <section className="grid shrink-0 gap-3 pb-4">
            <SectionLabel>Message</SectionLabel>
            <div className="grid gap-1.5">
              <Label>Template</Label>
              <Select
                value={state.templateId ?? "custom"}
                onValueChange={(value) => {
                  if (value === "custom") {
                    update({ ...state, templateId: null });
                    return;
                  }
                  const template = data.templates.find((item) => item.id === value);
                  update({
                    ...state,
                    templateId: value,
                    ...(template === undefined
                      ? {}
                      : { subject: template.subjectTemplate, body: template.bodyTemplate }),
                  });
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
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-subject">Subject</Label>
              <Input
                id="campaign-subject"
                value={state.subject}
                onChange={(event) => update({ ...state, subject: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="campaign-body">Message</Label>
                <div className="flex flex-wrap justify-end gap-1">
                  {campaignMergeTokens.map((token) => (
                    <Button
                      key={token}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => update({ ...state, body: `${state.body}{${token}}` })}
                    >{`{${token}}`}</Button>
                  ))}
                </div>
              </div>
              <Textarea
                id="campaign-body"
                value={state.body}
                onChange={(event) => update({ ...state, body: event.target.value })}
                className="min-h-40"
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported — the message is sent in the event's email frame.
              </p>
            </div>
          </section>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
            <SectionLabel>Preview</SectionLabel>
            <Select value={preview?.id ?? ""} onValueChange={setPreviewId}>
              <SelectTrigger size="sm" className="w-48">
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
          <div className="shrink-0 border-b px-3 py-2">
            <p className="truncate text-xs font-semibold">
              {resolvedSubject.trim() === "" ? "No subject yet" : resolvedSubject}
            </p>
          </div>
          <CampaignEmailPreview
            subject={resolvedSubject}
            body={resolvedBody}
            className="min-h-[320px] flex-1"
          />
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 lg:px-6">
        <div>
          {dirty ? (
            <Button type="button" size="sm" variant="ghost" onClick={discard}>
              <Trash2Icon /> Discard draft
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
          </span>
          <Button
            className="pressable"
            disabled={
              send.isPending ||
              recipients.length === 0 ||
              state.subject.trim() === "" ||
              state.body.trim() === ""
            }
            onClick={() => send.mutate()}
          >
            <SendIcon /> {send.isPending ? "Queuing…" : `Send to ${recipients.length}`}
          </Button>
        </div>
      </footer>
      <SpeakerPickerDialog
        open={picker === "speakers"}
        onOpenChange={(open) => setPicker(open ? "speakers" : null)}
        contacts={data.speakers}
        value={selectedIds}
        onChange={(next) => update({ ...state, selectedIds: [...next] })}
        title="Select recipients"
        description="Search and filter the speaker directory, then pick who receives this campaign."
      />
      <SpeakerPickerDialog
        open={picker === "submitters"}
        onOpenChange={(open) => setPicker(open ? "submitters" : null)}
        contacts={data.submitters.map((submitter) => ({
          id: submitter.id,
          firstName: submitter.firstName,
          lastName: submitter.lastName,
          email: submitter.email,
          headshotUrl: submitter.headshotUrl,
          company: null,
        }))}
        value={selectedSubmitterIds}
        onChange={(next) => update({ ...state, selectedSubmitterIds: [...next] })}
        title="Select submitters"
        description="Search everyone who submitted, then pick who receives this campaign."
        noun="submitters"
        contactLabel="Submitter"
      />
    </main>
  );
}
