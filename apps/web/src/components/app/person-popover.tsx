import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";

import { plainTextFromRichText } from "@opensesh/domain";
import { qk } from "@/lib/query-keys";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { getEventContactProfile } from "@/server-fns/portal";

export interface PersonPopoverData {
  readonly id?: string;
  readonly name: string;
  readonly image: string | null;
  readonly title?: string | null;
  readonly company?: string | null;
  readonly bio?: string | null;
  readonly status?: string | null;
  readonly sessionsCount?: number;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const statusClassName: Readonly<Record<string, string>> = {
  invited: "bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
  onboarding: "bg-[var(--status-maybe)] text-[var(--status-maybe-foreground)]",
  confirmed: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  ready: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  declined: "bg-[var(--status-declined)] text-[var(--status-declined-foreground)]",
};

export function PersonHoverCard({
  person,
  children,
  side = "bottom",
}: {
  readonly person: PersonPopoverData;
  readonly children: ReactElement;
  readonly side?: "top" | "right" | "bottom" | "left";
}) {
  const context = useAdminEvent();
  const [open, setOpen] = useState(false);
  const eventId = context?.event.id;
  const needsProfile =
    person.id !== undefined &&
    eventId !== undefined &&
    person.title === undefined &&
    person.company === undefined &&
    person.bio === undefined &&
    person.status === undefined &&
    person.sessionsCount === undefined;
  const profile = useQuery({
    queryKey: qk.contactProfile(eventId ?? "none", person.id ?? "none"),
    queryFn: () =>
      getEventContactProfile({
        data: { eventId: eventId ?? "", contactId: person.id ?? "" },
      }),
    enabled: open && needsProfile,
    staleTime: 60_000,
  });
  const loaded = profile.data?.ok ? profile.data.data : undefined;
  const display: PersonPopoverData =
    loaded === undefined
      ? person
      : {
          id: loaded.contact.id,
          name: `${loaded.contact.firstName} ${loaded.contact.lastName}`,
          image: loaded.contact.headshotUrl,
          title: loaded.contact.title,
          company: loaded.contact.company,
          bio: loaded.contact.bio,
          status: loaded.contact.pipeline,
          sessionsCount: loaded.sessionCount,
        };
  const secondary = [display.title, display.company].filter(Boolean).join(" · ");
  const bio =
    display.bio === undefined || display.bio === null ? "" : plainTextFromRichText(display.bio);

  return (
    <HoverCard openDelay={350} closeDelay={150} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="w-72 p-3"
      >
        <div className="flex items-start gap-3">
          <Avatar className="size-10 rounded-md">
            {display.image === null ? null : <AvatarImage src={display.image} alt="" />}
            <AvatarFallback className="rounded-md text-xs">{initials(display.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium">{display.name}</p>
              {display.status === undefined || display.status === null ? null : (
                <Badge
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize",
                    statusClassName[display.status],
                  )}
                >
                  {display.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            {secondary.length === 0 ? null : (
              <p className="truncate text-xs text-muted-foreground">{secondary}</p>
            )}
          </div>
        </div>
        {bio.length === 0 ? null : (
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{bio}</p>
        )}
        {display.id === undefined || eventId === undefined ? null : (
          <div className="mt-3 flex items-center gap-3 border-t pt-2 text-xs">
            <Link
              to="/admin/speakers"
              search={{ spotlight: display.id }}
              className="pressable font-medium hover:underline"
            >
              View speaker
            </Link>
            {display.sessionsCount === undefined ? null : (
              <span className="text-muted-foreground">
                {display.sessionsCount} session{display.sessionsCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
