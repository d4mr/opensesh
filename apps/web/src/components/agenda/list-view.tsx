import type { AgendaAdminData, AgendaSession, ScheduleChange } from "@opensesh/domain";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateKeyFor, formatDay, formatTime } from "./date-utils";
import { ScheduleEditor } from "./schedule-editor";
import { SessionPeek } from "./session-peek";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, AgendaSession>();

export function AgendaListView({
  agenda,
  save,
}: {
  readonly agenda: AgendaAdminData;
  readonly save: (change: ScheduleChange) => Promise<boolean>;
}) {
  const timezone = agenda.event.timezone;
  const roomById = new Map(agenda.rooms.map((room) => [room.id, room.name]));
  // Track the peeked session by id and derive the row from live agenda data —
  // holding the object would freeze the open dialog on pre-mutation state.
  const [peekSessionId, setPeekSessionId] = useState<string | null>(null);
  const peekSession =
    peekSessionId === null
      ? null
      : (agenda.sessions.find((session) => session.id === peekSessionId) ?? null);
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("code", {
          header: "Code",
          cell: ({ row }) => (
            <span className="font-mono text-xs tabular-nums">{row.original.code}</span>
          ),
        }),
        columnHelper.accessor("title", {
          header: "Session",
          cell: ({ row }) => (
            <div className="max-w-96">
              <p className="truncate font-medium">{row.original.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.speakers.map((speaker) => speaker.name).join(", ") || "No speaker"}
              </p>
            </div>
          ),
        }),
        columnHelper.display({
          id: "scheduled",
          header: "Scheduled",
          cell: ({ row }) =>
            row.original.startsAt === null ? (
              <Badge variant="outline" className="rounded-md text-muted-foreground">
                <CircleDashedIcon /> No
              </Badge>
            ) : (
              <Badge className="rounded-md bg-status-accepted text-status-accepted-foreground">
                <CheckCircle2Icon /> Yes
              </Badge>
            ),
        }),
        columnHelper.display({
          id: "day-time",
          header: "Day & time",
          cell: ({ row }) =>
            row.original.startsAt === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span>
                {formatDay(dateKeyFor(row.original.startsAt, timezone))},{" "}
                {formatTime(row.original.startsAt, timezone)}
              </span>
            ),
        }),
        columnHelper.display({
          id: "room",
          header: "Room",
          cell: ({ row }) =>
            row.original.roomId === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              (roomById.get(row.original.roomId) ?? "—")
            ),
        }),
        columnHelper.display({
          id: "duration",
          header: "Duration",
          cell: ({ row }) => {
            const minutes =
              row.original.startsAt === null || row.original.endsAt === null
                ? row.original.durationMinutes
                : Math.round(
                    (Date.parse(row.original.endsAt) - Date.parse(row.original.startsAt)) / 60_000,
                  );
            return <span className="tabular-nums">{minutes} min</span>;
          },
        }),
        columnHelper.display({
          id: "edit",
          header: "",
          // The editor lives inside a clickable row; stop propagation so
          // opening it never also pops the peek dialog.
          cell: ({ row }) => (
            <span
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <ScheduleEditor agenda={agenda} session={row.original} save={save} />
            </span>
          ),
        }),
      ]),
    [agenda, roomById, save, timezone],
  );
  const table = useTable({ features, columns, data: agenda.sessions, getRowId: (row) => row.id });

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="h-8">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan} className="h-8 text-xs">
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
              className="pressable-row h-11 cursor-pointer"
              onClick={() => setPeekSessionId(row.id)}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className="py-1.5 text-[13px]">
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <SessionPeek
        agenda={agenda}
        session={peekSession}
        open={peekSession !== null}
        onOpenChange={(open) => !open && setPeekSessionId(null)}
        save={save}
      />
    </div>
  );
}
