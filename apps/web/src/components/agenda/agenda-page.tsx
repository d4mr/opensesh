import {
  detectAgendaConflicts,
  type AgendaAdminData,
  type AgendaConflict,
  type AgendaView,
  type ScheduleChange,
  validateScheduleChange,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarCheckIcon, ChevronDownIcon, CircleDotIcon, EyeOffIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CalendarInviteAction } from "@/components/agenda/calendar-invite-action";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendaQuery } from "@/lib/agenda-queries";
import { changeAgendaPublication, getAgenda, saveAgendaSchedule } from "@/server-fns/agenda";
import { deleteLibraryItem, saveLibraryItem } from "@/server-fns/admin";
import { ConflictsView } from "./conflicts-view";
import { dateKeyFor, eventDateKeys } from "./date-utils";
import { AgendaListView } from "./list-view";
import { RoomsView } from "./rooms-view";

type AgendaResult = Awaited<ReturnType<typeof getAgenda>>;

export function AgendaPage({
  view,
  day,
  navigate,
}: {
  readonly view: AgendaView;
  readonly day: string | undefined;
  readonly navigate: (view: AgendaView, day: string) => void;
}) {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const queryClient = useQueryClient();
  const agenda = useSuspenseQuery(agendaQuery(eventId));
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(new Set());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const ready = agenda.data.ok ? agenda.data.data : null;
  const conflicts = useMemo(
    () => (ready === null ? [] : detectAgendaConflicts(ready.sessions)),
    [ready],
  );
  if (context === null) return null;
  if (!agenda.data.ok) return <p className="p-6 text-sm">{agenda.data.error.message}</p>;
  const data = agenda.data.data;
  const days = eventDateKeys(data.event.startsAt, data.event.endsAt, data.event.timezone);
  const selectedDay = day !== undefined && days.includes(day) ? day : (days[0] ?? "");
  const queryKey = agendaQuery(eventId).queryKey;

  const setAgenda = (next: AgendaAdminData) =>
    queryClient.setQueryData<AgendaResult>(queryKey, (current) =>
      current?.ok ? { ...current, data: next } : current,
    );

  const save = useCallback(
    async (change: ScheduleChange, announce = true) => {
      const previous = queryClient.getQueryData<AgendaResult>(queryKey);
      if (previous?.ok !== true) return false;
      const previousSession = previous.data.sessions.find(
        (session) => session.id === change.submissionId,
      );
      if (previousSession === undefined) return false;
      const validation = validateScheduleChange(change, {
        timezone: previous.data.event.timezone,
        startsAt: previous.data.event.startsAt,
        endsAt: previous.data.event.endsAt,
        roomIds: previous.data.rooms.map((room) => room.id),
      });
      if (validation !== null) {
        toast.error(validation);
        return false;
      }
      const optimistic: AgendaAdminData = {
        ...previous.data,
        event: { ...previous.data.event, agendaDirty: true },
        sessions: previous.data.sessions.map((session) =>
          session.id === change.submissionId
            ? {
                ...session,
                roomId: change.roomId,
                startsAt: change.startsAt,
                endsAt: change.endsAt,
                scheduleDirty: true,
              }
            : session,
        ),
      };
      queryClient.setQueryData<AgendaResult>(queryKey, (current) =>
        current?.ok ? { ...current, data: optimistic } : current,
      );

      let result: Awaited<ReturnType<typeof saveAgendaSchedule>>;
      try {
        result = await saveAgendaSchedule({ data: change });
      } catch {
        queryClient.setQueryData(queryKey, previous);
        toast.error("Could not update the schedule");
        return false;
      }
      if (!result.ok) {
        queryClient.setQueryData(queryKey, previous);
        toast.error(result.error.message);
        return false;
      }
      setAgenda(result.data);
      if (announce) {
        const message =
          change.startsAt === null
            ? "Session returned to the pool"
            : previousSession.startsAt === null
              ? "Session scheduled"
              : "Schedule updated";
        toast.success(message, {
          action: {
            label: "Undo",
            onClick: () =>
              void save(
                {
                  eventId,
                  submissionId: previousSession.id,
                  roomId: previousSession.roomId,
                  startsAt: previousSession.startsAt,
                  endsAt: previousSession.endsAt,
                },
                false,
              ),
          },
        });
      }
      return true;
    },
    [eventId, queryClient, queryKey],
  );

  const addRoom = async (name: string) => {
    const result = await saveLibraryItem({
      data: {
        eventId,
        kind: "room",
        id: null,
        name,
        color: null,
        durationMinutes: null,
      },
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    setAgenda({
      ...data,
      rooms: [
        ...data.rooms,
        { id: result.data.id, name: result.data.name, position: result.data.position },
      ],
    });
    toast.success("Room added", {
      action: {
        label: "Undo",
        onClick: () => {
          void deleteLibraryItem({ data: { eventId, kind: "room", id: result.data.id } }).then(() =>
            agenda.refetch(),
          );
        },
      },
    });
    return true;
  };

  const publish = async (action: "publish" | "unpublish") => {
    const result = await changeAgendaPublication({ data: { eventId, action } });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setAgenda(result.data);
    toast.success(action === "publish" ? "Agenda published" : "Agenda unpublished");
  };

  const jump = (conflict: AgendaConflict) => {
    const session = data.sessions.find((item) => item.id === conflict.sessionIds[0]);
    const targetDay =
      session?.startsAt === null || session?.startsAt === undefined
        ? selectedDay
        : dateKeyFor(session.startsAt, data.event.timezone);
    setHighlightedIds(new Set(conflict.sessionIds));
    navigate("rooms", targetDay);
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedIds(new Set()), 2000);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Agenda builder</h1>
            <Badge variant="outline" className="rounded-md text-[11px]">
              {data.event.agendaPublishedAt === null ? "Draft" : "Published"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Place accepted sessions, resolve conflicts, then publish a public snapshot.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.event.agendaDirty ? (
            <Badge variant="outline" className="gap-1 rounded-md text-[11px] text-muted-foreground">
              <CircleDotIcon className="size-3" /> Unpublished changes
            </Badge>
          ) : null}
          <CalendarInviteAction />
          <div className="flex">
            <Button
              size="sm"
              className="pressable rounded-r-none"
              disabled={data.event.agendaPublishedAt !== null && !data.event.agendaDirty}
              onClick={() => void publish("publish")}
            >
              <CalendarCheckIcon />
              {data.event.agendaPublishedAt === null
                ? "Publish agenda"
                : data.event.agendaDirty
                  ? "Republish agenda"
                  : "Published"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  className="pressable rounded-l-none border-l border-primary-foreground/20"
                  aria-label="Agenda publication options"
                >
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={data.event.agendaPublishedAt === null}
                  onSelect={() => void publish("unpublish")}
                >
                  <EyeOffIcon /> Unpublish agenda
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs
        value={view}
        onValueChange={(value) =>
          (value === "rooms" || value === "list" || value === "conflicts") &&
          navigate(value, selectedDay)
        }
        className="min-h-0 flex-1"
      >
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="rooms" className="pressable h-8 px-3 text-xs">
            Rooms
          </TabsTrigger>
          <TabsTrigger value="list" className="pressable h-8 px-3 text-xs">
            List
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="pressable h-8 px-3 text-xs">
            Conflicts
            <span
              className={
                conflicts.length === 0
                  ? "text-muted-foreground tabular-nums"
                  : "rounded-sm bg-destructive px-1 text-[10px] text-destructive-foreground tabular-nums"
              }
            >
              {conflicts.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rooms" className="mt-1 min-h-0">
          <RoomsView
            agenda={data}
            day={selectedDay}
            onDayChange={(nextDay) => navigate("rooms", nextDay)}
            conflictedIds={new Set(conflicts.flatMap((conflict) => conflict.sessionIds))}
            highlightedIds={highlightedIds}
            save={save}
            addRoom={addRoom}
          />
        </TabsContent>
        <TabsContent value="list" className="mt-1">
          <AgendaListView agenda={data} save={save} />
        </TabsContent>
        <TabsContent value="conflicts" className="mt-1">
          <ConflictsView agenda={data} conflicts={conflicts} jump={jump} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
