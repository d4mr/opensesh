import type {
  CampaignHistory,
  CampaignRecipientHistory,
  CommunicationCenter,
} from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CopyPlusIcon, MailIcon } from "lucide-react";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  CampaignEmailPreview,
  DeliveryChip,
  DeliveryCountChip,
  campaignAudienceLabel,
  deliveryRollup,
  recipientDelivery,
} from "@/components/admin/communications-shared";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import { Button } from "@/components/ui/button";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { communicationCenterQuery } from "@/lib/communication-queries";
import { cn } from "@/lib/utils";

interface PageProps {
  readonly campaignId: string;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (
    id: string | undefined,
    options: { readonly replace: boolean; readonly keyboard: boolean },
  ) => void;
}

export function CampaignPage(props: PageProps) {
  const context = useAdminEvent();
  if (context === null) return null;
  return <CampaignData eventId={context.event.id} timezone={context.event.timezone} {...props} />;
}

function CampaignData({
  eventId,
  timezone,
  ...props
}: PageProps & { readonly eventId: string; readonly timezone: string }) {
  const result = useSuspenseQuery(communicationCenterQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  const entry = result.data.data.campaigns.find(
    (candidate) => candidate.campaign.id === props.campaignId,
  );
  if (entry === undefined) {
    return (
      <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 p-4 text-sm lg:p-6">
        <AdminEmptyState
          icon={MailIcon}
          title="Campaign not found"
          description="It may belong to another event, or the link is stale."
          action={
            <Button size="sm" variant="outline" className="pressable" asChild>
              <Link to="/admin/communications" search={{ tab: "campaigns", spotlight: undefined }}>
                <ArrowLeftIcon /> Back to communications
              </Link>
            </Button>
          }
        />
      </main>
    );
  }
  return <Campaign entry={entry} data={result.data.data} timezone={timezone} {...props} />;
}

function Campaign({
  entry,
  data,
  timezone,
  spotlightId,
  onSpotlightChange,
}: Omit<PageProps, "campaignId"> & {
  readonly entry: CampaignHistory;
  readonly data: CommunicationCenter;
  readonly timezone: string;
}) {
  const rollup = deliveryRollup(entry.recipients);
  const pages = usePagination(entry.recipients, {
    spotlightId,
    getId: (recipient) => recipient.id,
  });
  const spotlightRecipient = entry.recipients.find((recipient) => recipient.id === spotlightId);
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={entry.recipients.map((recipient) => recipient.id)}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="shrink-0">
              <Button variant="ghost" size="xs" asChild className="mb-2 -ml-2">
                <Link
                  to="/admin/communications"
                  search={{ tab: "campaigns", spotlight: undefined }}
                >
                  <ArrowLeftIcon /> Back to communications
                </Link>
              </Button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold">
                    {entry.campaign.subjectSnapshot}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {campaignAudienceLabel(entry.campaign)} ·{" "}
                    {entry.templateName ?? "Custom message"} ·{" "}
                    {entry.campaign.sentAt === null ? (
                      <span className="text-[var(--status-pending)]">Sending…</span>
                    ) : (
                      <>
                        Sent{" "}
                        <Timestamp
                          value={entry.campaign.sentAt}
                          timezone={timezone}
                          className="tabular-nums"
                        />
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {rollup.sent > 0 ? (
                      <DeliveryCountChip bucket="sent" count={rollup.sent} />
                    ) : null}
                    {rollup.queued > 0 ? (
                      <DeliveryCountChip bucket="queued" count={rollup.queued} />
                    ) : null}
                    {rollup.failed > 0 ? (
                      <DeliveryCountChip bucket="failed" count={rollup.failed} />
                    ) : null}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="pressable shrink-0" asChild>
                  <Link
                    to="/admin/communications/new"
                    search={{ audience: undefined, from: entry.campaign.id }}
                  >
                    <CopyPlusIcon /> Use as new campaign
                  </Link>
                </Button>
              </div>
            </div>
            <TableShell
              scrollRef={scrollRef}
              footer={
                <PaginationFooter
                  page={pages.page}
                  pageSize={pages.pageSize}
                  total={entry.recipients.length}
                  onPageChange={pages.setPage}
                />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    {compact ? null : <TableHead>Resolved subject</TableHead>}
                    <TableHead>Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.pageItems.map((recipient) => (
                    <TableRow
                      key={recipient.id}
                      ref={rowRef(recipient.id)}
                      className={cn("h-9 cursor-pointer", rowClassName(recipient.id))}
                      onClick={() => openSpotlight(recipient.id)}
                    >
                      <TableCell>
                        <p className="font-medium">{recipient.contactName}</p>
                        <p className="text-xs text-muted-foreground">{recipient.email}</p>
                      </TableCell>
                      {compact ? null : (
                        <TableCell className="max-w-72">
                          <p className="truncate text-muted-foreground">
                            {recipient.resolvedSubject}
                          </p>
                        </TableCell>
                      )}
                      <TableCell>
                        <DeliveryChip recipient={recipient} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </div>
        )}
        panel={
          spotlightRecipient === undefined ? null : (
            <RecipientSpotlight
              data={data}
              recipient={spotlightRecipient}
              onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
            />
          )
        }
      />
    </main>
  );
}

// "What did this person actually get" — delivery facts up top, then the exact
// rendered email from the per-recipient snapshot.
function RecipientSpotlight({
  data,
  recipient,
  onClose,
}: {
  readonly data: CommunicationCenter;
  readonly recipient: CampaignRecipientHistory;
  readonly onClose: () => void;
}) {
  const isSpeaker = data.speakers.some((speaker) => speaker.id === recipient.contactId);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={<span className="truncate text-sm font-medium">{recipient.contactName}</span>}
        status={<DeliveryChip recipient={recipient} />}
        actions={
          <>
            {isSpeaker ? (
              <Button size="xs" variant="ghost" className="pressable" asChild>
                <Link to="/admin/speakers" search={{ spotlight: recipient.contactId }}>
                  Profile
                </Link>
              </Button>
            ) : null}
            {recipient.emailLogId === null ? null : (
              <Button size="xs" variant="ghost" className="pressable" asChild>
                <Link to="/admin/emails" search={{ email: recipient.emailLogId }}>
                  Outbox
                </Link>
              </Button>
            )}
          </>
        }
        onClose={onClose}
      />
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <MailIcon className="size-3.5 shrink-0" />
        <span className="truncate">{recipient.email}</span>
      </div>
      {recipientDelivery(recipient) === "failed" ? (
        <div className="shrink-0 border-b px-3 py-2 text-xs font-medium text-[var(--status-declined)]">
          Delivery failed — the outbox entry has the provider error.
        </div>
      ) : null}
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-xs font-semibold">{recipient.resolvedSubject}</p>
      </div>
      <CampaignEmailPreview
        subject={recipient.resolvedSubject}
        body={recipient.resolvedBody}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
