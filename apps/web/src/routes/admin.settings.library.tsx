import type { LibraryKind } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { adminEventsQuery } from "@/lib/review-desk-queries";
import { qk } from "@/lib/query-keys";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { RouteError } from "@/components/app/route-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { deleteLibraryItem, getEventLibrary, saveLibraryItem } from "@/server-fns/admin";

// Fixed track palette (seed colors first) — a curated row of swatches instead
// of the native color picker, so track dots stay legible on both themes.
const trackPalette = [
  "#0f766e",
  "#7c3aed",
  "#c2410c",
  "#2563eb",
  "#059669",
  "#c026d3",
  "#e11d48",
  "#d97706",
];

const eventLibraryQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.library(eventId),
    queryFn: () => getEventLibrary({ data: { eventId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/settings/library")({
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId !== undefined) {
      await context.queryClient.ensureQueryData(eventLibraryQuery(eventId));
    }
  },
  component: EventLibrary,
});

interface LibraryRow {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly durationMinutes?: number;
}

function EventLibrary() {
  const context = useAdminEvent();
  const eventId = context?.event.id;
  const library = useSuspenseQuery(eventLibraryQuery(eventId ?? ""));
  if (context === null || eventId === undefined) return null;
  if (!library.data.ok) return <RouteError error={library.data.error} />;
  const data = library.data.data;
  return (
    // The whole pane scrolls as one region, title included.
    <main className="h-[calc(100svh-var(--header-height)-1rem)] overflow-y-auto p-4 text-sm lg:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Program library</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reusable values for forms, submissions, and agenda planning.
        </p>
      </div>
      <div className="grid content-start gap-4 pb-14 xl:grid-cols-2">
        <LibrarySection eventId={eventId} kind="track" title="Tracks" rows={data.tracks} />
        <LibrarySection eventId={eventId} kind="format" title="Formats" rows={data.formats} />
        <LibrarySection eventId={eventId} kind="room" title="Rooms" rows={data.rooms} />
        <LibrarySection eventId={eventId} kind="tag" title="Tags" rows={data.tags} />
        <LibrarySection eventId={eventId} kind="level" title="Levels" rows={data.levels} />
      </div>
    </main>
  );
}

function LibrarySection({
  eventId,
  kind,
  title,
  rows,
}: {
  readonly eventId: string;
  readonly kind: LibraryKind;
  readonly title: string;
  readonly rows: ReadonlyArray<LibraryRow>;
}) {
  const [editing, setEditing] = useState<LibraryRow | null>(null);
  const adding = editing !== null && editing.id === "";
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3">
        <span className="text-xs font-medium">{title}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{rows.length}</span>
        <Button
          size="sm"
          variant="ghost"
          className="pressable ml-auto h-7 px-2 text-xs"
          aria-label={`Add ${title.toLowerCase()}`}
          disabled={editing !== null}
          onClick={() => setEditing({ id: "", name: "" })}
        >
          <PlusIcon className="size-3.5" /> Add
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="h-8 hover:bg-transparent">
              <TableHead className="h-8 px-3 text-xs">Name</TableHead>
              {kind === "format" ? (
                <TableHead className="h-8 w-28 px-2 text-xs">Duration</TableHead>
              ) : null}
              {kind === "track" ? (
                <TableHead className="h-8 w-56 px-2 text-xs">Color</TableHead>
              ) : null}
              <TableHead className="h-8 w-24 px-2 text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding ? (
              <LibraryEditor
                key="new"
                eventId={eventId}
                kind={kind}
                row={editing}
                cancel={() => setEditing(null)}
              />
            ) : null}
            {rows.map((row) =>
              // Editing replaces the row in place — it never teleports to the top.
              editing !== null && editing.id === row.id ? (
                <LibraryEditor
                  key={row.id}
                  eventId={eventId}
                  kind={kind}
                  row={editing}
                  cancel={() => setEditing(null)}
                />
              ) : (
                <LibraryDisplayRow
                  key={row.id}
                  eventId={eventId}
                  kind={kind}
                  row={row}
                  edit={() => setEditing(row)}
                />
              ),
            )}
            {rows.length === 0 && editing === null ? (
              <TableRow>
                <TableCell colSpan={3} className="h-12 text-center text-xs text-muted-foreground">
                  No {title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LibraryEditor({
  eventId,
  kind,
  row,
  cancel,
}: {
  readonly eventId: string;
  readonly kind: LibraryKind;
  readonly row: LibraryRow;
  readonly cancel: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: row.name,
      color: row.color ?? trackPalette[0] ?? "#0f766e",
      durationMinutes: row.durationMinutes ?? 30,
    },
    onSubmit: async ({ value }) => {
      const result = await saveLibraryItem({
        data: {
          eventId,
          kind,
          id: row.id || null,
          name: value.name,
          color: kind === "track" ? value.color : null,
          durationMinutes: kind === "format" ? value.durationMinutes : null,
        },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      cancel();
      await invalidateAfterMutation(queryClient, eventId);
    },
  });
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/20">
      <TableCell className="px-3 py-1.5">
        <form.Field name="name">
          {(field) => (
            <Input
              aria-label={kind === "format" ? "Format name (without duration)" : "Name"}
              className="h-7 text-[13px]"
              autoFocus
              value={field.state.value}
              onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter") void form.handleSubmit();
                if (keyboardEvent.key === "Escape") cancel();
              }}
            />
          )}
        </form.Field>
      </TableCell>
      {kind === "format" ? (
        <TableCell className="px-2 py-1.5">
          <form.Field name="durationMinutes">
            {(field) => (
              <Input
                aria-label="Duration in minutes"
                className="h-7 text-[13px] tabular-nums"
                type="number"
                min={1}
                value={field.state.value}
                onChange={(inputEvent) => field.handleChange(inputEvent.target.valueAsNumber)}
              />
            )}
          </form.Field>
        </TableCell>
      ) : null}
      {kind === "track" ? (
        <TableCell className="px-2 py-1.5">
          <form.Field name="color">
            {(field) => (
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="radiogroup"
                aria-label="Track color"
              >
                {trackPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={field.state.value === color}
                    aria-label={`Color ${color}`}
                    className={cn(
                      "pressable size-4.5 rounded-full transition-shadow",
                      field.state.value === color
                        ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                        : "hover:ring-2 hover:ring-border hover:ring-offset-2 hover:ring-offset-background",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => field.handleChange(color)}
                  />
                ))}
              </div>
            )}
          </form.Field>
        </TableCell>
      ) : null}
      <TableCell className="px-2 py-1.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="pressable text-muted-foreground"
            aria-label="Cancel"
            onClick={cancel}
          >
            <XIcon />
          </Button>
          <form.Subscribe selector={(state) => [state.isSubmitting, state.values.name] as const}>
            {([submitting, name]) => (
              <Button
                size="sm"
                className="pressable h-7"
                disabled={submitting || name.trim().length === 0}
                onClick={() => void form.handleSubmit()}
              >
                Save
              </Button>
            )}
          </form.Subscribe>
        </div>
      </TableCell>
    </TableRow>
  );
}

function LibraryDisplayRow({
  eventId,
  kind,
  row,
  edit,
}: {
  readonly eventId: string;
  readonly kind: LibraryKind;
  readonly row: LibraryRow;
  readonly edit: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = async () => {
    const result = await deleteLibraryItem({ data: { eventId, kind, id: row.id } });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await invalidateAfterMutation(queryClient, eventId);
  };
  return (
    <TableRow className="h-9">
      <TableCell className="px-3 text-[13px] font-medium">{row.name}</TableCell>
      {kind === "format" ? (
        <TableCell className="px-2 text-[13px] text-muted-foreground tabular-nums">
          {row.durationMinutes} min
        </TableCell>
      ) : null}
      {kind === "track" ? (
        <TableCell className="px-2">
          <span
            className="inline-block size-3 rounded-full"
            style={{ backgroundColor: row.color }}
          />
        </TableCell>
      ) : null}
      <TableCell className="px-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="pressable text-muted-foreground"
            aria-label={`Edit ${row.name}`}
            onClick={edit}
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="pressable text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${row.name}`}
            onClick={() => void remove()}
          >
            <Trash2Icon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
