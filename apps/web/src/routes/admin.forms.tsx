import type { FormSummary } from "@opensesh/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

import { useAdminEvent } from "@/components/app/admin-event-context";
import { StatusBadge } from "@/components/app/status-badge";
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

export const Route = createFileRoute("/admin/forms")({ component: FormsList });

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function FormsList() {
  const context = useAdminEvent();
  const eventId = context?.event.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const forms = useQuery({
    queryKey: ["forms", eventId],
    queryFn: () => getFormSummaries({ data: { eventId: eventId ?? "" } }),
    enabled: eventId !== undefined,
  });
  if (context === null || eventId === undefined || forms.data === undefined) return null;
  if (!forms.data.ok) return <p className="p-6 text-sm">{forms.data.error.message}</p>;
  const create = async () => {
    setCreating(true);
    const result = await createForm({ data: { eventId } });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["forms", eventId] });
    await navigate({ to: "/admin/forms/$formId", params: { formId: result.data.id } });
  };
  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Submission forms</h1>
          <p className="text-sm text-muted-foreground">
            Collect proposals and participant information for {context.event.name}.
          </p>
        </div>
        <Button size="sm" disabled={creating} onClick={() => void create()}>
          <PlusIcon /> {creating ? "Creating…" : "Create form"}
        </Button>
      </div>
      <div className="grid max-w-5xl gap-2">
        {forms.data.data.map((form) => (
          <FormCard key={form.id} form={form} eventSlug={context.event.slug} />
        ))}
        {forms.data.data.length === 0 ? (
          <Card className="py-10 text-center">
            <CardContent>
              <FileInputIcon className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 font-medium">No submission forms yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create one to open your CFP.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function FormCard({ form, eventSlug }: { readonly form: FormSummary; readonly eventSlug: string }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const closed =
    form.status === "closed" || (form.closeDate !== null && form.closeDate <= new Date());
  const publicPath = `/submit/${eventSlug}/${form.id}`;
  const duplicate = async () => {
    const result = await duplicateForm({ data: { eventId: form.eventId, formId: form.id } });
    if (!result.ok) toast.error(result.error.message);
    else await queryClient.invalidateQueries({ queryKey: ["forms", form.eventId] });
  };
  const remove = async () => {
    setConfirmOpen(false);
    const result = await deleteForm({ data: { eventId: form.eventId, formId: form.id } });
    if (!result.ok) toast.error(result.error.message);
    else await queryClient.invalidateQueries({ queryKey: ["forms", form.eventId] });
  };
  return (
    <>
      <Card className="gap-0 py-0">
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
              {form.closeDate === null ? "" : ` · Closes ${dateFormat.format(form.closeDate)}`}
              {` · Created ${dateFormat.format(form.createdAt)}`}
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
