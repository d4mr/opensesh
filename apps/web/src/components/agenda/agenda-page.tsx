import {
  detectAgendaConflicts,
  type AgendaAdminData,
  type AgendaConflict,
  type AgendaDraft,
  type AgendaDraftActionRequest,
  type AgendaView,
  type GenerateAgendaDraftRequest,
  type ScheduleChange,
  validateScheduleChange,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  CalendarCheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  EyeOffIcon,
  SparklesIcon,
} from "lucide-react";
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
import { agendaDraftsQuery, agendaQuery } from "@/lib/agenda-queries";
import {
  acceptAgendaDraft,
  changeAgendaDraft,
  changeAgendaPublication,
  generateAgendaDraft,
  getAgenda,
  listAgendaDrafts,
  saveAgendaSchedule,
} from "@/server-fns/agenda";
import { deleteLibraryItem, saveLibraryItem } from "@/server-fns/admin";
import { ConflictsView } from "./conflicts-view";
import { AgendaDraftCompare } from "./agenda-draft-compare";
import { AgendaDraftsSheet } from "./agenda-drafts-sheet";
import { dateKeyFor, eventDateKeys } from "./date-utils";
import { AgendaListView } from "./list-view";
import { RoomsView } from "./rooms-view";

type AgendaResult = Awaited<ReturnType<typeof getAgenda>>;
type AgendaDraftsResult = Awaited<ReturnType<typeof listAgendaDrafts>>;

export function AgendaPage({
  view,
  day,
  draftId,
  navigate,
}: {
  readonly view: AgendaView;
  readonly day: string | undefined;
  readonly draftId: string | undefined;
  readonly navigate: (view: AgendaView, day: string, draftId?: string) => void;
}) {
  const context = useAdminEvent();
  const eventId = context?.event.id ?? "";
  const queryClient = useQueryClient();
  const agenda = useSuspenseQuery(agendaQuery(eventId));
  const drafts = useSuspenseQuery(agendaDraftsQuery(eventId));
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(new Set());
  const [draftsOpen, setDraftsOpen] = useState(false);
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
  const draftsQueryKey = agendaDraftsQuery(eventId).queryKey;

  const setAgenda = (next: AgendaAdminData) =>
    queryClient.setQueryData<AgendaResult>(queryKey, (current) =>
      current?.ok ? { ...current, data: next } : current,
    );

  const setDrafts = (next: ReadonlyArray<AgendaDraft>) =>
    queryClient.setQueryData<AgendaDraftsResult>(draftsQueryKey, (current) =>
      current?.ok ? { ...current, data: next } : current,
    );

  const draftRows = drafts.data.ok ? drafts.data.data : [];
  const selectedDraft = draftRows.find((draft) => draft.id === draftId);

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

  const generateDraft = async (input: GenerateAgendaDraftRequest) => {
    const result = await generateAgendaDraft({ data: input });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDrafts([result.data, ...draftRows]);
    setDraftsOpen(false);
    navigate(view, selectedDay, result.data.id);
    toast.success("Agenda draft ready to compare");
  };

  const draftAction = async (draft: AgendaDraft, action: AgendaDraftActionRequest["action"]) => {
    const previous = queryClient.getQueryData<AgendaDraftsResult>(draftsQueryKey);
    const now = new Date().toISOString();
    const optimisticId = `optimistic-${draft.id}`;
    setDrafts(
      action === "discard"
        ? draftRows.map((item) =>
            item.id === draft.id ? { ...item, status: "discarded", updatedAt: now } : item,
          )
        : [
            {
              ...draft,
              id: optimisticId,
              name: `${draft.name} copy`,
              status: "draft",
              proposal: { placements: [] },
              generatedAt: null,
              committedAt: null,
              createdAt: now,
              updatedAt: now,
            },
            ...draftRows,
          ],
    );
    const result = await changeAgendaDraft({
      data: { eventId, draftId: draft.id, action },
    });
    if (!result.ok) {
      queryClient.setQueryData(draftsQueryKey, previous);
      toast.error(result.error.message);
      return;
    }
    const current = queryClient.getQueryData<AgendaDraftsResult>(draftsQueryKey);
    const rows = current?.ok === true ? current.data : draftRows;
    setDrafts(
      action === "duplicate"
        ? rows.map((item) => (item.id === optimisticId ? result.data : item))
        : rows.map((item) => (item.id === result.data.id ? result.data : item)),
    );
    toast.success(action === "duplicate" ? "Draft duplicated" : "Draft discarded");
  };

  const discardComparedDraft = async () => {
    if (selectedDraft === undefined) return;
    const previous = queryClient.getQueryData<AgendaDraftsResult>(draftsQueryKey);
    setDrafts(
      draftRows.map((draft) =>
        draft.id === selectedDraft.id ? { ...draft, status: "discarded" } : draft,
      ),
    );
    navigate(view, selectedDay);
    const result = await changeAgendaDraft({
      data: { eventId, draftId: selectedDraft.id, action: "discard" },
    });
    if (!result.ok) {
      queryClient.setQueryData(draftsQueryKey, previous);
      navigate(view, selectedDay, selectedDraft.id);
      toast.error(result.error.message);
      return;
    }
    setDrafts(draftRows.map((draft) => (draft.id === result.data.id ? result.data : draft)));
    toast.success("Draft discarded");
  };

  const acceptDraftChanges = async (submissionIds: ReadonlyArray<string>) => {
    if (selectedDraft === undefined) return;
    const selectedIds = new Set(submissionIds);
    const selectedPlacements = selectedDraft.proposal.placements.filter((placement) =>
      selectedIds.has(placement.submissionId),
    );
    const optimisticAgenda: AgendaAdminData = {
      ...data,
      event: { ...data.event, agendaDirty: true },
      sessions: data.sessions.map((session) => {
        const placement = selectedPlacements.find((item) => item.submissionId === session.id);
        return placement === undefined
          ? session
          : {
              ...session,
              roomId: placement.roomId,
              startsAt: placement.startsAt,
              endsAt: placement.endsAt,
              scheduleDirty: true,
            };
      }),
    };
    if (detectAgendaConflicts(optimisticAgenda.sessions).length > 0) {
      toast.error("Those selected changes conflict with the current live agenda");
      return;
    }
    const previousAgenda = queryClient.getQueryData<AgendaResult>(queryKey);
    const previousDrafts = queryClient.getQueryData<AgendaDraftsResult>(draftsQueryKey);
    setAgenda(optimisticAgenda);
    setDrafts(
      draftRows.map((draft) =>
        draft.id === selectedDraft.id ? { ...draft, status: "committed" } : draft,
      ),
    );
    const targetDay =
      selectedPlacements[0] === undefined
        ? selectedDay
        : dateKeyFor(selectedPlacements[0].startsAt, data.event.timezone);
    setHighlightedIds(selectedIds);
    navigate("rooms", targetDay);
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedIds(new Set()), 2000);

    const result = await acceptAgendaDraft({
      data: { eventId, draftId: selectedDraft.id, submissionIds: [...selectedIds] },
    });
    if (!result.ok) {
      queryClient.setQueryData(queryKey, previousAgenda);
      queryClient.setQueryData(draftsQueryKey, previousDrafts);
      setHighlightedIds(new Set());
      navigate(view, selectedDay, selectedDraft.id);
      toast.error(result.error.message);
      return;
    }
    setAgenda(result.data.agenda);
    setDrafts(
      draftRows.map((draft) => (draft.id === result.data.draft.id ? result.data.draft : draft)),
    );
    toast.success(
      `${result.data.changedSubmissionIds.length} ${result.data.changedSubmissionIds.length === 1 ? "change" : "changes"} accepted`,
    );
  };

  if (selectedDraft !== undefined) {
    return (
      <AgendaDraftCompare
        key={selectedDraft.id}
        agenda={data}
        draft={selectedDraft}
        back={() => navigate(view, selectedDay)}
        accept={acceptDraftChanges}
        discard={discardComparedDraft}
      />
    );
  }

  return (
    // Height = viewport minus the site header and the inset-variant m-2
    // margins, so this page owns exactly one scroll surface (the grid).
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-3 overflow-hidden p-4 text-sm lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {data.event.agendaDirty ? (
            <Badge variant="outline" className="gap-1 rounded-md text-[11px] text-muted-foreground">
              <CircleDotIcon className="size-3" /> Unpublished changes
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="pressable"
            onClick={() => setDraftsOpen(true)}
          >
            <SparklesIcon /> AI drafts
          </Button>
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
        <TabsContent value="rooms" className="mt-1 flex min-h-0 flex-col">
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
        <TabsContent value="list" className="mt-1 min-h-0 overflow-y-auto">
          <AgendaListView agenda={data} save={save} />
        </TabsContent>
        <TabsContent value="conflicts" className="mt-1 min-h-0 overflow-y-auto">
          <ConflictsView agenda={data} conflicts={conflicts} jump={jump} />
        </TabsContent>
      </Tabs>
      <AgendaDraftsSheet
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        agenda={data}
        drafts={draftRows}
        generate={generateDraft}
        compare={(nextDraftId) => {
          setDraftsOpen(false);
          navigate(view, selectedDay, nextDraftId);
        }}
        action={(draft, action) => void draftAction(draft, action)}
      />
    </main>
  );
}
