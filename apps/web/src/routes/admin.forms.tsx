import type { FormSummary } from "@opensesh/domain";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FileInputIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateAfterMutation } from "@/lib/after-mutation";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Timestamp } from "@/components/app/timestamp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createForm, deleteForm, duplicateForm, getFormSummaries } from "@/server-fns/forms";
import { getAdminBootstrap } from "@/server-fns/admin";

const adminEventsQuery = queryOptions({
  queryKey: ["admin-events"],
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

const formsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["forms", eventId],
    queryFn: () => getFormSummaries({ data: { eventId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/forms")({
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) await context.queryClient.ensureQueryData(formsQuery(eventId));
  },
  component: FormsList,
});

function FormsList() {
  const context = useAdminEvent();
  const eventId = context?.event.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const forms = useSuspenseQuery(formsQuery(eventId ?? ""));
  if (context === null || eventId === undefined) return null;
  if (!forms.data.ok) return <p className="p-6 text-sm">{forms.data.error.message}</p>;
  const create = async () => {
    setCreating(true);
    const result = await createForm({ data: { eventId } });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await invalidateAfterMutation(queryClient);
    await navigate({ to: "/admin/forms/$formId", params: { formId: result.data.id } });
  };
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden p-4 text-sm lg:p-6">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Call for Papers</h1>
          <p className="text-sm text-muted-foreground">
            Collect proposals and participant information for {context.event.name}.
          </p>
        </div>
        <Button size="sm" disabled={creating} onClick={() => void create()}>
          <PlusIcon /> {creating ? "Creating…" : "Create form"}
        </Button>
      </div>
      <div className="grid min-h-0 max-w-5xl flex-1 content-start gap-2 overflow-y-auto">
        {forms.data.data.map((form) => (
          <FormCard
            key={form.id}
            form={form}
            eventSlug={context.event.slug}
            timezone={context.event.timezone}
          />
        ))}
        {forms.data.data.length === 0 ? (
          <AdminEmptyState
            icon={FileInputIcon}
            title="Open your call for papers"
            description="Create a form to collect proposals and participant details."
            action={
              <Button
                size="sm"
                className="pressable"
                disabled={creating}
                onClick={() => void create()}
              >
                <PlusIcon /> Create form
              </Button>
            }
          />
        ) : null}
      </div>
    </main>
  );
}

function FormCard({
  form,
  eventSlug,
  timezone,
}: {
  readonly form: FormSummary;
  readonly eventSlug: string;
  readonly timezone: string;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const closed =
    form.status === "closed" || (form.closeDate !== null && form.closeDate <= new Date());
  const publicPath = `/submit/${eventSlug}/${form.id}`;
  const duplicate = async () => {
    const result = await duplicateForm({ data: { eventId: form.eventId, formId: form.id } });
    if (!result.ok) toast.error(result.error.message);
    else await invalidateAfterMutation(queryClient);
  };
  const remove = async () => {
    setConfirmOpen(false);
    const result = await deleteForm({ data: { eventId: form.eventId, formId: form.id } });
    if (!result.ok) toast.error(result.error.message);
    else await invalidateAfterMutation(queryClient);
  };
  return (
    <>
      <Card className="min-w-0 gap-0 py-0">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
            {form.submissions}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                className="truncate font-medium hover:underline"
                to="/admin/forms/$formId"
                params={{ formId: form.id }}
              >
                {form.internalName}
              </Link>
              <StatusBadge status={closed ? "closed" : "open"} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {form.submissions} submissions · {form.drafts} drafts
              {form.closeDate === null ? null : (
                <>
                  {" · Closes "}
                  <Timestamp value={form.closeDate} timezone={timezone} mode="date" />
                </>
              )}
              {" · Created "}
              <Timestamp value={form.createdAt} timezone={timezone} mode="date" />
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/forms/$formId" params={{ formId: form.id }}>
              Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Actions for ${form.internalName}`}
              >
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void duplicate()}>
                <CopyIcon /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void navigator.clipboard.writeText(`${window.location.origin}${publicPath}`)
                }
              >
                <CopyIcon /> Copy public link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={publicPath} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon /> View form
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2Icon /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {form.internalName}?</DialogTitle>
            <DialogDescription>
              The form and its draft configuration will be removed. Existing submissions remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
