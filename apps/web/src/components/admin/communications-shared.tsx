import type { AudienceSegment, CampaignRecipientHistory, EmailCampaign } from "@opensesh/domain";
import { renderCampaignEmail } from "@opensesh/domain";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { cn } from "@/lib/utils";

export const audienceLabels: Readonly<Record<AudienceSegment, string>> = {
  all_speakers: "All speakers",
  confirmed: "Confirmed speakers",
  awaiting_confirmation: "Awaiting confirmation",
  incomplete_tasks: "Incomplete tasks",
  selected: "Selected speakers",
  awaiting_decision: "Submitters awaiting decision",
  declined: "Declined submitters",
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

const deliveryChipClasses: Readonly<Record<DeliveryBucket, string>> = {
  sent: "border-[color:var(--status-accepted-border)] bg-[var(--status-accepted-muted)] text-[var(--status-accepted)]",
  queued:
    "border-[color:var(--status-pending-border)] bg-[var(--status-pending-muted)] text-[var(--status-pending)]",
  failed:
    "border-[color:var(--status-declined-border)] bg-[var(--status-declined-muted)] text-[var(--status-declined)]",
};

export function DeliveryChip({
  recipient,
  className,
}: {
  readonly recipient: CampaignRecipientHistory;
  readonly className?: string;
}) {
  const bucket = recipientDelivery(recipient);
  const label = recipient.emailStatus ?? (bucket === "queued" ? "queued" : bucket);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium capitalize",
        deliveryChipClasses[bucket],
        className,
      )}
    >
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
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        deliveryChipClasses[bucket],
        className,
      )}
    >
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
