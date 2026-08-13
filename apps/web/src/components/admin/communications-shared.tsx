import type { AudienceSegment, CampaignRecipientHistory, EmailCampaign } from "@opensesh/domain";
import { renderCampaignEmail } from "@opensesh/domain";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { statusClassName, statusIcon } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";

export const audienceLabels: Readonly<Record<AudienceSegment, string>> = {
  all_speakers: "All speakers",
  confirmed: "Confirmed speakers",
  awaiting_confirmation: "Awaiting confirmation",
  incomplete_tasks: "Incomplete tasks",
  selected: "Selected speakers",
  all_submitters: "All submitters",
  awaiting_decision: "Submitters awaiting decision",
  declined: "Declined submitters",
  selected_submitters: "Selected submitters",
};

export const campaignAudienceLabel = (campaign: EmailCampaign) => {
  const segment = campaign.recipientFilter.segment;
  return typeof segment === "string" && segment in audienceLabels
    ? audienceLabels[segment as AudienceSegment]
    : "Custom audience";
};

// One recipient's delivery, collapsed to what an organizer acts on. The email
// log is the source of truth once the send is queued; the campaign row's own
// deliveryStatus only matters before a log row exists.
export type DeliveryBucket = "sent" | "queued" | "failed";

export const recipientDelivery = (recipient: CampaignRecipientHistory): DeliveryBucket => {
  const status = recipient.emailStatus ?? recipient.deliveryStatus;
  if (status === "sent" || status === "demo") return "sent";
  if (status === "failed") return "failed";
  return "queued";
};

export const deliveryRollup = (recipients: ReadonlyArray<CampaignRecipientHistory>) => {
  const counts = { sent: 0, queued: 0, failed: 0 };
  for (const recipient of recipients) counts[recipientDelivery(recipient)] += 1;
  return counts;
};

// Delivery renders in the app's one status-badge language (solid status fill,
// icon, capitalized word) — buckets borrow the submission-status palette.
const deliveryStatus: Readonly<Record<DeliveryBucket, "accepted" | "pending" | "declined">> = {
  sent: "accepted",
  queued: "pending",
  failed: "declined",
};

export function DeliveryChip({
  recipient,
  className,
}: {
  readonly recipient: CampaignRecipientHistory;
  readonly className?: string;
}) {
  const bucket = recipientDelivery(recipient);
  const Icon = statusIcon[deliveryStatus[bucket]];
  const label = recipient.emailStatus ?? bucket;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize",
        statusClassName[deliveryStatus[bucket]],
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

// Aggregate variant of the chip for campaign-level roll-ups ("12 sent").
export function DeliveryCountChip({
  bucket,
  count,
  className,
}: {
  readonly bucket: DeliveryBucket;
  readonly count: number;
  readonly className?: string;
}) {
  const Icon = statusIcon[deliveryStatus[bucket]];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        statusClassName[deliveryStatus[bucket]],
        className,
      )}
    >
      <Icon className="size-3" />
      {count} {bucket}
    </span>
  );
}

export function SectionLabel({ children }: { readonly children: string }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

// Renders exactly what the send path renders — the branded outreach frame.
export function CampaignEmailPreview({
  subject,
  body,
  className,
}: {
  readonly subject: string;
  readonly body: string;
  readonly className?: string;
}) {
  const context = useAdminEvent();
  const rendered = renderCampaignEmail({
    eventName: context?.event.name ?? "Event",
    logoUrl: context?.event.logoUrl ?? null,
    subject,
    body,
  });
  return (
    <iframe
      title={`Preview of ${subject}`}
      sandbox=""
      srcDoc={rendered.html}
      className={cn("w-full bg-white", className)}
    />
  );
}
