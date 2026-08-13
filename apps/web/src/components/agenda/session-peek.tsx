import type { AgendaAdminData, AgendaSession, ScheduleChange } from "@opensesh/domain";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { PersonHoverCard } from "@/components/app/person-popover";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { RichText } from "@/components/forms/rich-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime } from "./date-utils";
import { ScheduleEditor } from "./schedule-editor";

export function AgendaSpeakerNames({
  speakers,
  tags = false,
}: {
  readonly speakers: AgendaSession["speakers"];
  readonly tags?: boolean;
}) {
  if (speakers.length === 0) return <>No speaker</>;
  return (
    <>
      {speakers.map((speaker, index) => (
        <span key={speaker.id}>
          {index === 0 || tags ? null : ", "}
          {tags ? (
            <SpeakerBadge
              side="right"
              person={{ id: speaker.id, name: speaker.name, image: null }}
            />
          ) : (
            <PersonHoverCard
              side="right"
              person={{ id: speaker.id, name: speaker.name, image: null }}
            >
              <span>{speaker.name}</span>
            </PersonHoverCard>
          )}
        </span>
      ))}
    </>
  );
}

export function SessionPeek({
  agenda,
  session,
  open,
  onOpenChange,
  save,
}: {
  readonly agenda: AgendaAdminData;
  readonly session: AgendaSession | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly save: (change: ScheduleChange) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {session === null ? null : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {session.code}
                </span>
                {session.tracks.map((track) => (
                  <span
                    key={track.id}
                    className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none"
                    style={{
                      borderColor: track.color,
                      color: track.color,
                      backgroundColor: `color-mix(in srgb, ${track.color} 9%, transparent)`,
                    }}
                  >
                    {track.name}
                  </span>
                ))}
              </div>
              <DialogTitle className="text-base tracking-tight">{session.title}</DialogTitle>
              <DialogDescription>
                {session.formatName ?? "Session"} · {session.durationMinutes} minutes ·{" "}
                {session.startsAt === null
                  ? "Unscheduled"
                  : formatTime(session.startsAt, agenda.event.timezone)}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[50svh] gap-3 overflow-y-auto text-sm">
              <div className="flex flex-wrap items-center gap-1">
                <AgendaSpeakerNames speakers={session.speakers} tags />
              </div>
              <RichText
                markdown={session.description}
                className="leading-relaxed text-muted-foreground"
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="pressable text-muted-foreground"
                asChild
              >
                <Link to="/admin/sessions" search={{ state: "all", spotlight: session.id }}>
                  <ExternalLinkIcon /> Open session
                </Link>
              </Button>
              <ScheduleEditor agenda={agenda} session={session} save={save} />
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
