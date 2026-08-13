import type { SessionListItem, TimelineEntry } from "@opensesh/domain";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BanIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  FileTextIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";

import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpotlightPanelHeader } from "@/components/app/spotlight";
import { Timestamp } from "@/components/app/timestamp";
import { RichText } from "@/components/forms/rich-text";
import { Button } from "@/components/ui/button";
import { submissionTimelineQuery } from "@/lib/review-desk-queries";
import { cn } from "@/lib/utils";

function ReadinessRow({
  ready,
  label,
  detail,
  to,
  search,
}: {
  readonly ready: boolean;
  readonly label: string;
  readonly detail?: string;
  readonly to?: string;
  readonly search?: Record<string, string>;
}) {
  const body = (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {ready ? (
        <CheckCircle2Icon className="size-3.5 shrink-0 text-status-accepted" />
      ) : (
        <CircleDashedIcon className="size-3.5 shrink-0 text-[var(--status-pending)]" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail === undefined ? null : (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detail}</span>
      )}
    </span>
  );
  if (to === undefined) return <div className="flex h-8 items-center px-2 text-sm">{body}</div>;
  return (
    <Link
      to={to}
      search={search}
      className="flex h-8 items-center rounded-sm px-2 text-sm hover:bg-accent"
    >
      {body}
    </Link>
  );
}

function TimelineList({
  eventId,
  submissionId,
  timezone,
}: {
  readonly eventId: string;
  readonly submissionId: string;
  readonly timezone: string;
}) {
  const timeline = useQuery(submissionTimelineQuery(eventId, submissionId));
  if (timeline.data === undefined) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading activity…</p>;
  }
  if (!timeline.data.ok) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">Activity is unavailable.</p>;
  }
  const entries: ReadonlyArray<TimelineEntry> = timeline.data.data;
  return (
    <ol className="px-2 py-1">
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex gap-2.5 text-xs">
          {/* The rail: each entry draws its dot plus the segment down to the
              next dot, so the line never overshoots the first or last entry. */}
          <span className="flex w-1.5 shrink-0 flex-col items-center">
            {/* The 5px above each dot is drawn as rail (not margin) so the
                incoming segment meets the dot instead of stopping short. */}
            <span
              className={cn("h-[5px] w-px shrink-0", index === 0 ? "" : "bg-border")}
              aria-hidden
            />
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                entry.kind === "cancelled"
                  ? "bg-destructive"
                  : entry.kind === "decided" || entry.kind === "reinstated"
                    ? "bg-status-accepted"
                    : "bg-muted-foreground/40",
              )}
            />
            {index === entries.length - 1 ? null : (
              <span className="w-px flex-1 bg-border" aria-hidden />
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-2 pb-2.5">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{entry.label}</span>
              {entry.detail === null ? null : (
                <span className="text-muted-foreground"> — {entry.detail}</span>
              )}
              {entry.actorName === null ? null : (
                <span className="text-muted-foreground"> · {entry.actorName}</span>
              )}
            </span>
            <Timestamp
              value={entry.at}
              timezone={timezone}
              className="shrink-0 text-muted-foreground"
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

// The session lens: readiness, never acceptance. Decisions live on the
// Submissions desk; the exits from here are cancel/reinstate (and delete,
// for manually added sessions created by mistake).
export function SessionSpotlight({
  eventId,
  timezone,
  session,
  onClose,
  onCancel,
  onReinstate,
  onDelete,
  deleting,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly session: SessionListItem;
  readonly onClose: () => void;
  readonly onCancel: () => void;
  readonly onReinstate: () => void;
  readonly onDelete: () => void;
  readonly deleting: boolean;
}) {
  const cancelled = session.cancelledAt !== null;
  const confirmedSpeakers = session.speakers.filter((speaker) => speaker.confirmedAt !== null);
  const scheduled = session.startsAt !== null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={
          <span className="flex items-center gap-2 text-xs">
            <span className="font-mono tabular-nums">{session.code}</span>
            {session.source === "manual" ? (
              <span className="rounded-sm border px-1 py-px text-[10px] text-muted-foreground">
                Manual
              </span>
            ) : null}
            {cancelled ? (
              <span className="rounded-sm border border-destructive/40 px-1 py-px text-[10px] text-destructive">
                Cancelled
              </span>
            ) : null}
          </span>
        }
        actions={
          cancelled ? (
            <Button size="xs" variant="outline" className="pressable" onClick={onReinstate}>
              <RotateCcwIcon /> Reinstate
            </Button>
          ) : (
            <Button size="xs" variant="outline" className="pressable" onClick={onCancel}>
              <BanIcon /> Cancel session
            </Button>
          )
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <h2 className="text-base font-semibold">{session.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {session.format ?? "No format"}
            {session.tracks.length === 0
              ? ""
              : ` · ${session.tracks.map((track) => track.name).join(", ")}`}
          </p>
        </div>

        {cancelled ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="font-medium">
              Cancelled by the {session.cancelledBy ?? "organizer"}{" "}
              <Timestamp value={session.cancelledAt ?? new Date()} timezone={timezone} />
            </p>
            <p className="mt-1 text-muted-foreground">
              Off the agenda and public pages; open per-session tasks were waived. Reinstate to
              restore the slot and reopen them.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <p className="border-b bg-muted/30 px-2 py-1.5 text-xs font-medium">Readiness</p>
            <div className="p-1">
              {/* The most upstream fact: an unsent decision blocks everything
                  downstream (the speaker can't even see they're accepted). */}
              {session.source === "cfp" ? (
                <ReadinessRow
                  ready={session.decisionSent}
                  label={session.decisionSent ? "Decision sent" : "Decision not sent"}
                  detail={session.decisionSent ? undefined : "Inform from Submissions"}
                  to="/admin/submissions"
                  search={{ status: "to_inform" }}
                />
              ) : null}
              <ReadinessRow
                ready={
                  session.speakers.length > 0 &&
                  confirmedSpeakers.length === session.speakers.length
                }
                label="Speakers confirmed"
                detail={`${confirmedSpeakers.length}/${session.speakers.length}`}
                to="/admin/speakers"
              />
              <ReadinessRow
                ready={scheduled}
                label={scheduled ? "Scheduled" : "Not scheduled"}
                detail={
                  scheduled ? (session.roomName === null ? undefined : session.roomName) : undefined
                }
                to="/admin/agenda"
              />
              {session.deliverablesTotal > 0 ? (
                <ReadinessRow
                  ready={session.deliverablesUploaded === session.deliverablesTotal}
                  label="Deliverables uploaded"
                  detail={`${session.deliverablesUploaded}/${session.deliverablesTotal}`}
                  to="/admin/files"
                />
              ) : null}
              {session.tasksTotal > 0 ? (
                <ReadinessRow
                  ready={session.tasksDone === session.tasksTotal}
                  label="Tasks complete"
                  detail={`${session.tasksDone}/${session.tasksTotal}`}
                  to="/admin/tasks"
                />
              ) : null}
              <ReadinessRow
                ready={session.publicationApproved}
                label={
                  session.publicationApproved
                    ? "Content approved for publication"
                    : "Not public yet"
                }
                to="/admin/content"
              />
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <p className="border-b bg-muted/30 px-2 py-1.5 text-xs font-medium">Speakers</p>
          <div className="space-y-1 p-2">
            {session.speakers.map((speaker) => (
              <div key={speaker.id} className="flex items-center gap-2 text-sm">
                <SpeakerBadge
                  person={{ id: speaker.id, name: speaker.name, image: speaker.headshotUrl }}
                />
                <span className="ml-auto text-xs text-muted-foreground">
                  {speaker.confirmedAt === null ? (
                    <span className="inline-flex items-center gap-1">
                      <CircleDashedIcon className="size-3 text-[var(--status-pending)]" /> Awaiting
                      confirmation
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2Icon className="size-3 text-status-accepted" /> Confirmed
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {scheduled ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            <Timestamp value={session.startsAt ?? new Date()} timezone={timezone} />
            {session.roomName === null ? null : <span>· {session.roomName}</span>}
          </p>
        ) : null}

        {session.description.length === 0 ? null : (
          <div className="text-sm">
            <RichText markdown={session.description} />
          </div>
        )}

        <div className="rounded-md border">
          <p className="border-b bg-muted/30 px-2 py-1.5 text-xs font-medium">Activity</p>
          <div className="max-h-72 overflow-y-auto p-1">
            <TimelineList eventId={eventId} submissionId={session.id} timezone={timezone} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t p-3">
        {session.source === "cfp" ? (
          <Button asChild size="xs" variant="outline" className="pressable">
            <Link to="/admin/submissions" search={{ status: "all", spotlight: session.id }}>
              <FileTextIcon /> View submission
            </Link>
          </Button>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Added manually — there is no submission to decline.
            </span>
            <Button
              size="xs"
              variant="ghost"
              className="pressable ml-auto text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={onDelete}
            >
              <Trash2Icon /> {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
