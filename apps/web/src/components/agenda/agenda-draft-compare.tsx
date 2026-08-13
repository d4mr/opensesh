import type {
  AgendaAdminData,
  AgendaDraft,
  AgendaDraftPlacement,
  AgendaSession,
} from "@opensesh/domain";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateKeyFor, formatDay, formatTime } from "./date-utils";
import { DraftCalendar } from "./draft-calendar";

interface CompareRow {
  readonly session: AgendaSession;
  readonly proposal: AgendaDraftPlacement;
}

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, CompareRow>();

const isChanged = (session: AgendaSession, proposal: AgendaDraftPlacement) =>
  session.roomId !== proposal.roomId ||
  session.startsAt !== proposal.startsAt ||
  session.endsAt !== proposal.endsAt;

const CurrentSlot = ({
  session,
  agenda,
}: {
  readonly session: AgendaSession;
  readonly agenda: AgendaAdminData;
}) => {
  if (session.roomId === null || session.startsAt === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const room = agenda.rooms.find((item) => item.id === session.roomId);
  return (
    <div>
      <p>
        {formatDay(dateKeyFor(session.startsAt, agenda.event.timezone))},{" "}
        {formatTime(session.startsAt, agenda.event.timezone)}
      </p>
      <p className="text-[11px] text-muted-foreground">{room?.name ?? "Unknown room"}</p>
    </div>
  );
};

const ProposedSlot = ({
  proposal,
  agenda,
}: {
  readonly proposal: AgendaDraftPlacement;
  readonly agenda: AgendaAdminData;
}) => {
  const room = agenda.rooms.find((item) => item.id === proposal.roomId);
  return (
    <div className="flex items-center gap-2">
      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p>
          {formatDay(dateKeyFor(proposal.startsAt, agenda.event.timezone))},{" "}
          {formatTime(proposal.startsAt, agenda.event.timezone)}
        </p>
        <p className="text-[11px] text-muted-foreground">{room?.name ?? "Unknown room"}</p>
      </div>
    </div>
  );
};

export function AgendaDraftCompare({
  agenda,
  draft,
  back,
  accept,
  discard,
}: {
  readonly agenda: AgendaAdminData;
  readonly draft: AgendaDraft;
  readonly back: () => void;
  readonly accept: (submissionIds: ReadonlyArray<string>) => Promise<void>;
  readonly discard: () => Promise<void>;
}) {
  const rows = useMemo(
    () =>
      draft.proposal.placements.flatMap((proposal) => {
        const session = agenda.sessions.find((item) => item.id === proposal.submissionId);
        return session === undefined || !isChanged(session, proposal)
          ? []
          : [{ session, proposal }];
      }),
    [agenda.sessions, draft.proposal.placements],
  );
  const allIds = useMemo(() => rows.map((row) => row.session.id), [rows]);
  const changedIds = useMemo(() => new Set(allIds), [allIds]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(allIds));
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"changes" | "calendar">("changes");

  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(allIds) : new Set());
  const toggle = (submissionId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(submissionId);
      else next.delete(submissionId);
      return next;
    });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          header: () => (
            <Checkbox
              aria-label="Select all proposed changes"
              checked={
                selected.size === allIds.length && allIds.length > 0
                  ? true
                  : selected.size > 0
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) => toggleAll(checked === true)}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label={`Select ${row.original.session.title}`}
              checked={selected.has(row.original.session.id)}
              onCheckedChange={(checked) => toggle(row.original.session.id, checked === true)}
            />
          ),
        }),
        columnHelper.display({
          id: "session",
          header: "Session",
          cell: ({ row }) => (
            <div className="max-w-72">
              <p className="truncate font-medium">{row.original.session.title}</p>
              <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {row.original.session.code}
              </p>
            </div>
          ),
        }),
        columnHelper.display({
          id: "current",
          header: "Current",
          cell: ({ row }) => <CurrentSlot agenda={agenda} session={row.original.session} />,
        }),
        columnHelper.display({
          id: "proposed",
          header: "Proposed",
          cell: ({ row }) => <ProposedSlot agenda={agenda} proposal={row.original.proposal} />,
        }),
        columnHelper.accessor((row) => row.proposal.reason, {
          id: "reason",
          header: "Reason",
          cell: ({ row }) => (
            <p className="max-w-80 whitespace-normal text-xs leading-4 text-muted-foreground">
              {row.original.proposal.reason}
            </p>
          ),
        }),
      ]),
    [agenda, allIds, selected],
  );
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.session.id,
  });

  const commit = async (ids: ReadonlyArray<string>) => {
    setPending(true);
    await accept(ids);
    setPending(false);
  };

  return (
    <main className="wizard-step flex min-h-0 flex-1 flex-col gap-3 p-4 text-sm lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="pressable"
              onClick={back}
              aria-label="Back to agenda"
            >
              <ArrowLeftIcon />
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">{draft.name}</h1>
            <Badge variant="outline" className="gap-1 rounded-md text-[11px]">
              <WandSparklesIcon className="size-3" /> Auto-scheduled
            </Badge>
          </div>
          <p className="mt-0.5 ml-9 text-xs text-muted-foreground">
            Compare the proposal with the live agenda. Nothing changes until you accept.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="pressable text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() => void discard()}
          >
            <Trash2Icon /> Discard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="pressable"
            disabled={pending || allIds.length === 0}
            onClick={() => void commit(allIds)}
          >
            Accept all
          </Button>
          <Button
            size="sm"
            className="pressable"
            disabled={pending || selected.size === 0}
            onClick={() => void commit([...selected])}
          >
            <CheckIcon /> {pending ? "Accepting…" : `Accept ${selected.size} changes`}
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => (value === "changes" || value === "calendar") && setTab(value)}
      >
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="changes" className="pressable h-8 px-3 text-xs">
            Changes
            <span className="text-muted-foreground tabular-nums">{rows.length}</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="pressable h-8 px-3 text-xs">
            Calendar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-1 h-[70svh] min-h-96">
          <DraftCalendar
            agenda={agenda}
            placements={draft.proposal.placements}
            changedIds={changedIds}
          />
        </TabsContent>
        <TabsContent value="changes" className="mt-1">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <div className="flex h-9 items-center justify-between border-b bg-muted/30 px-3">
              <span className="text-xs font-medium">Proposed changes</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {selected.size} of {rows.length} selected
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="py-14 text-center">
                <CircleCheckIcon className="mx-auto size-5 text-[var(--status-accepted)]" />
                <p className="mt-2 text-sm font-medium">No live changes</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  This proposal already matches the current agenda.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="h-8 hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className="h-8 px-2 text-xs first:w-9"
                        >
                          {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="h-12"
                      data-state={selected.has(row.original.session.id) ? "selected" : undefined}
                    >
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id} className="px-2 py-1.5 text-[13px]">
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
