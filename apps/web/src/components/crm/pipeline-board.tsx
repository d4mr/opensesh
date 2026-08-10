import type { CrmPipelineStage, CrmSemanticStatus, CrmWorkspace } from "@opensesh/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crmWorkspaceQuery } from "@/lib/crm-queries";
import {
  deleteCrmStage,
  moveCrmCard,
  reorderCrmStages,
  saveCrmCard,
  saveCrmStage,
} from "@/server-fns/crm";

export function PipelineBoard({
  workspace,
  openContact,
}: {
  readonly workspace: CrmWorkspace;
  readonly openContact: (id: string) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Sourcing pipeline</h2>
          <p className="text-xs text-muted-foreground">
            {workspace.pipeline.columns.reduce((total, column) => total + column.cards.length, 0)}{" "}
            cards · every move records actor and timestamp
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            onClick={() => setManageOpen(true)}
          >
            <Settings2Icon /> Configure stages
          </Button>
          <Button size="sm" className="pressable" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add contact
          </Button>
        </div>
      </div>
      <div className="grid min-h-96 auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {workspace.pipeline.columns.map((column) => (
          <div key={column.stage.id} className="min-w-60 rounded-lg border bg-muted/15">
            <div className="flex h-10 items-center gap-2 border-b bg-muted/40 px-3">
              <span className="font-medium">{column.stage.name}</span>
              <Badge variant="outline" className="capitalize">
                {column.stage.semanticStatus}
              </Badge>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {column.cards.length}
              </span>
            </div>
            <div className="grid gap-2 p-2">
              {column.cards.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                  No contacts in this stage.
                </p>
              ) : (
                column.cards.map(({ card, contact }) => (
                  <PipelineCard
                    key={card.id}
                    workspace={workspace}
                    card={card}
                    contact={contact}
                    open={() => openContact(contact.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <ManageStagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        stages={workspace.pipeline.columns.map((column) => column.stage)}
      />
      <AddCardDialog open={addOpen} onOpenChange={setAddOpen} workspace={workspace} />
    </section>
  );
}

function PipelineCard({
  workspace,
  card,
  contact,
  open,
}: {
  readonly workspace: CrmWorkspace;
  readonly card: CrmWorkspace["pipeline"]["columns"][number]["cards"][number]["card"];
  readonly contact: CrmWorkspace["directory"][number]["contact"];
  readonly open: () => void;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(card.stageId);
  const move = useMutation({
    mutationFn: () => moveCrmCard({ data: { cardId: card.id, toStageId: target } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      const stage = workspace.pipeline.columns.find(
        (column) => column.stage.id === result.data.stageId,
      )?.stage;
      toast.success(`Moved ${contact.firstName} to ${stage?.name ?? "stage"}`);
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  return (
    <article className="rounded-md border bg-background p-2.5">
      <button
        type="button"
        className="pressable flex w-full items-start gap-2 text-left"
        onClick={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {contact.firstName} {contact.lastName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {contact.title ?? "No title"}
            {contact.company === null ? "" : ` · ${contact.company}`}
          </span>
          {card.note === null ? null : (
            <span className="mt-2 block line-clamp-2 text-xs">{card.note}</span>
          )}
        </span>
        <ChevronRightIcon className="mt-0.5 size-4 text-muted-foreground" />
      </button>
      <div className="mt-2 flex gap-1 border-t pt-2">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger
            size="sm"
            aria-label={`Move ${contact.firstName} to stage`}
            className="h-7 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspace.pipeline.columns.map((column) => (
              <SelectItem key={column.stage.id} value={column.stage.id}>
                {column.stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="xs"
          variant="outline"
          className="pressable"
          disabled={target === card.stageId || move.isPending}
          onClick={() => move.mutate()}
        >
          Move
        </Button>
      </div>
    </article>
  );
}

function AddCardDialog({
  open,
  onOpenChange,
  workspace,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspace: CrmWorkspace;
}) {
  const queryClient = useQueryClient();
  const existing = new Set(
    workspace.pipeline.columns.flatMap((column) => column.cards.map(({ contact }) => contact.id)),
  );
  const available = workspace.directory.filter((row) => !existing.has(row.contact.id));
  const [contactId, setContactId] = useState(available[0]?.contact.id ?? "");
  const [stageId, setStageId] = useState(workspace.pipeline.columns[0]?.stage.id ?? "");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () =>
      saveCrmCard({
        data: { organizationContactId: contactId, stageId, note: note.trim() || null },
      }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Contact added to pipeline");
      onOpenChange(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contact to pipeline</DialogTitle>
          <DialogDescription>
            Create one sourcing card with a current note. The initial stage is recorded in
            transition history.
          </DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Every CRM contact already has a pipeline card.
          </p>
        ) : (
          <div className="grid gap-3">
            <Field>
              <FieldLabel>Contact</FieldLabel>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((row) => (
                    <SelectItem key={row.contact.id} value={row.contact.id}>
                      {row.contact.firstName} {row.contact.lastName} ·{" "}
                      {row.contact.company ?? "No company"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Starting stage</FieldLabel>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspace.pipeline.columns.map((column) => (
                    <SelectItem key={column.stage.id} value={column.stage.id}>
                      {column.stage.name} · {column.stage.semanticStatus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="pipeline-note">Card note</FieldLabel>
              <Textarea
                id="pipeline-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Why this speaker is a fit…"
              />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="pressable"
            disabled={
              available.length === 0 || contactId === "" || stageId === "" || save.isPending
            }
            onClick={() => save.mutate()}
          >
            Add to pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StageDraft {
  readonly id: string;
  readonly name: string;
  readonly semanticStatus: CrmSemanticStatus;
  readonly position: number;
}

function ManageStagesDialog({
  open,
  onOpenChange,
  stages,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly stages: ReadonlyArray<CrmPipelineStage>;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<ReadonlyArray<StageDraft>>(stages);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CrmSemanticStatus>("open");
  useEffect(() => setDrafts(stages), [stages]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
  const save = useMutation({
    mutationFn: (draft: StageDraft) => saveCrmStage({ data: draft }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Stage saved");
      await refresh();
    },
  });
  const create = useMutation({
    mutationFn: () =>
      saveCrmStage({
        data: { id: null, name, semanticStatus: status, position: drafts.length + 1 },
      }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      setName("");
      toast.success("Stage added");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCrmStage({ data: { id } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success("Stage deleted");
      await refresh();
    },
  });
  const reorder = useMutation({
    mutationFn: (next: ReadonlyArray<StageDraft>) =>
      reorderCrmStages({ data: { stageIds: next.map((stage) => stage.id) } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      await refresh();
    },
  });
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    const current = next[index];
    const swap = next[target];
    if (current === undefined || swap === undefined) return;
    next[index] = swap;
    next[target] = current;
    setDrafts(next);
    reorder.mutate(next);
  };
  const update = (id: string, patch: Partial<Pick<StageDraft, "name" | "semanticStatus">>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure pipeline stages</DialogTitle>
          <DialogDescription>
            Open, won, and lost semantics power overview counts. Reorder controls save immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-lg border">
          {drafts.map((draft, index) => (
            <div key={draft.id} className="grid grid-cols-[1fr_120px_auto] items-center gap-2 p-2">
              <Input
                value={draft.name}
                onChange={(event) => update(draft.id, { name: event.target.value })}
              />
              <Select
                value={draft.semanticStatus}
                onValueChange={(value) => {
                  if (value === "open" || value === "won" || value === "lost")
                    update(draft.id, { semanticStatus: value });
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${draft.name} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${draft.name} down`}
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Save ${draft.name}`}
                  onClick={() => save.mutate({ ...draft, position: index + 1 })}
                >
                  <Settings2Icon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Delete ${draft.name}`}
                  onClick={() => remove.mutate(draft.id)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_120px_auto] gap-2 border-t pt-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New stage name"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              if (value === "open" || value === "won" || value === "lost") setStatus(value);
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="pressable"
            disabled={name.trim() === "" || create.isPending}
            onClick={() => create.mutate()}
          >
            <PlusIcon /> Add
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
