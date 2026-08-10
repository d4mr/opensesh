import type { LibraryKind } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteLibraryItem, getEventLibrary, saveLibraryItem } from "@/server-fns/admin";

export const Route = createFileRoute("/admin/settings/library")({ component: EventLibrary });

interface LibraryRow {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
  readonly durationMinutes?: number;
}

function EventLibrary() {
  const context = useAdminEvent();
  const eventId = context?.event.id;
  const library = useQuery({
    queryKey: ["event-library", eventId],
    queryFn: () => getEventLibrary({ data: { eventId: eventId ?? "" } }),
    enabled: eventId !== undefined,
  });
  if (context === null || eventId === undefined || library.data === undefined) return null;
  if (!library.data.ok) return <p className="p-6 text-sm">{library.data.error.message}</p>;
  const data = library.data.data;
  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Program library</h1>
        <p className="text-sm text-muted-foreground">
          Reusable values for forms, submissions, and agenda planning.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
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
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between border-b py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {editing === null ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: "", name: "" })}>
            <PlusIcon /> Add
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="h-8">
              <TableHead>Name</TableHead>
              {kind === "format" ? <TableHead className="w-28">Duration</TableHead> : null}
              {kind === "track" ? <TableHead className="w-20">Color</TableHead> : null}
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editing === null ? null : (
              <LibraryEditor
                key={editing.id || "new"}
                eventId={eventId}
                kind={kind}
                row={editing}
                cancel={() => setEditing(null)}
              />
            )}
            {rows.map((row) => (
              <LibraryDisplayRow
                key={row.id}
                eventId={eventId}
                kind={kind}
                row={row}
                edit={() => setEditing(row)}
              />
            ))}
            {rows.length === 0 && editing === null ? (
              <TableRow>
                <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
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
      color: row.color ?? "#1d6b4c",
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
      await queryClient.invalidateQueries({ queryKey: ["event-library", eventId] });
    },
  });
  return (
    <TableRow>
      <TableCell>
        <form.Field name="name">
          {(field) => (
            <Input
              aria-label="Name"
              className="h-7"
              autoFocus
              value={field.state.value}
              onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter") void form.handleSubmit();
              }}
            />
          )}
        </form.Field>
      </TableCell>
      {kind === "format" ? (
        <TableCell>
          <form.Field name="durationMinutes">
            {(field) => (
              <Input
                aria-label="Duration in minutes"
                className="h-7"
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
        <TableCell>
          <form.Field name="color">
            {(field) => (
              <Input
                aria-label="Color"
                className="h-7 p-1"
                type="color"
                value={field.state.value}
                onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
              />
            )}
          </form.Field>
        </TableCell>
      ) : null}
      <TableCell className="text-right">
        <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={cancel}>
          <XIcon />
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => void form.handleSubmit()}
            >
              Save
            </Button>
          )}
        </form.Subscribe>
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
    await queryClient.invalidateQueries({ queryKey: ["event-library", eventId] });
  };
  return (
    <TableRow className="h-9">
      <TableCell className="font-medium">{row.name}</TableCell>
      {kind === "format" ? <TableCell>{row.durationMinutes} min</TableCell> : null}
      {kind === "track" ? (
        <TableCell>
          <span
            className="inline-block size-3 rounded-full border"
            style={{ backgroundColor: row.color }}
          />
        </TableCell>
      ) : null}
      <TableCell className="space-x-1 text-right">
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.name}`} onClick={edit}>
          <PencilIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Delete ${row.name}`}
          onClick={() => void remove()}
        >
          <Trash2Icon />
        </Button>
      </TableCell>
    </TableRow>
  );
}
