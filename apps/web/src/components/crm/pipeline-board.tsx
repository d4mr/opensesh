import type { CrmPipelineStage, CrmSemanticStatus, CrmWorkspace } from "@opensesh/domain";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  UserRoundIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { crmWorkspaceQuery } from "@/lib/crm-queries";
import { cn } from "@/lib/utils";
import {
  deleteCrmStage,
  getCrmWorkspace,
  moveCrmCard,
  reorderCrmStages,
  saveCrmCard,
  saveCrmStage,
} from "@/server-fns/crm";

type PipelineRow = CrmWorkspace["pipeline"]["columns"][number]["cards"][number];
type CrmWorkspaceResult = Awaited<ReturnType<typeof getCrmWorkspace>>;
type MoveInput = {
  readonly cardId: string;
  readonly toStageId: string;
  readonly contactName: string;
};

const cardDndId = (cardId: string) => `crm-card:${cardId}`;
const stageDndId = (stageId: string) => `crm-stage:${stageId}`;

// pointerWithin needs a pointer, so keyboard drags (no pointer coordinates)
// would never find a drop target without the rect-intersection fallback.
const boardCollisions: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

// Keyboard drags jump whole stages: ← and → move the card onto the previous
// or next column's drop zone instead of nudging by pixels.
const stageCoordinateGetter: KeyboardCoordinateGetter = (event, { context }) => {
  const { droppableRects, droppableContainers, collisionRect } = context;
  if (collisionRect === null) return undefined;
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return undefined;
  event.preventDefault();
  const columns = droppableContainers
    .getEnabled()
    .map((container) => ({ id: container.id, rect: droppableRects.get(container.id) }))
    .filter(
      (entry): entry is { id: UniqueIdentifier; rect: ClientRect } => entry.rect !== undefined,
    )
    .sort((left, right) => left.rect.left - right.rect.left);
  if (columns.length === 0) return undefined;
  const centerX = collisionRect.left + collisionRect.width / 2;
  const currentIndex = columns.reduce((best, entry, index) => {
    const entryCenter = entry.rect.left + entry.rect.width / 2;
    const bestEntry = columns[best];
    if (bestEntry === undefined) return index;
    const bestCenter = bestEntry.rect.left + bestEntry.rect.width / 2;
    return Math.abs(entryCenter - centerX) < Math.abs(bestCenter - centerX) ? index : best;
  }, 0);
  const next = columns[event.code === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1];
  if (next === undefined) return undefined;
  return {
    x: next.rect.left + next.rect.width / 2 - collisionRect.width / 2,
    // Clear the column's sticky header row so the lifted card doesn't
    // cover the stage name while keyboard-dragging.
    y: next.rect.top + 48,
  };
};

const moveOptimistically = (
  current: CrmWorkspaceResult | undefined,
  cardId: string,
  toStageId: string,
): CrmWorkspaceResult | undefined => {
  if (current === undefined || !current.ok) return current;
  const row = current.data.pipeline.columns
    .flatMap((column) => column.cards)
    .find(({ card }) => card.id === cardId);
  if (row === undefined) return current;
  return {
    ok: true,
    data: {
      ...current.data,
      pipeline: {
        ...current.data.pipeline,
        columns: current.data.pipeline.columns.map((column) => ({
          ...column,
          cards:
            column.stage.id === toStageId
              ? [
                  ...column.cards.filter(({ card }) => card.id !== cardId),
                  { ...row, card: { ...row.card, stageId: toStageId, updatedAt: new Date() } },
                ]
              : column.cards.filter(({ card }) => card.id !== cardId),
        })),
      },
    },
  };
};

export function PipelineBoard({
  workspace,
  openContact,
}: {
  readonly workspace: CrmWorkspace;
  readonly openContact: (id: string) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<PipelineRow | null>(null);
  // The dragged card's real height sizes the drop placeholder, so the gap
  // that opens in the target column matches the card that will land there.
  const [activeHeight, setActiveHeight] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: stageCoordinateGetter }),
  );
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ cardId, toStageId }: MoveInput) => moveCrmCard({ data: { cardId, toStageId } }),
    onMutate: async ({ cardId, toStageId }) => {
      await queryClient.cancelQueries({ queryKey: crmWorkspaceQuery.queryKey });
      const previous = queryClient.getQueryData<CrmWorkspaceResult>(crmWorkspaceQuery.queryKey);
      queryClient.setQueryData<CrmWorkspaceResult>(crmWorkspaceQuery.queryKey, (current) =>
        moveOptimistically(current, cardId, toStageId),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(crmWorkspaceQuery.queryKey, context?.previous);
      toast.error("Could not move the contact");
    },
    onSuccess: (result, variables, context) => {
      if (!result.ok) {
        queryClient.setQueryData(crmWorkspaceQuery.queryKey, context?.previous);
        toast.error(result.error.message);
        return;
      }
      const stage = workspace.pipeline.columns.find(
        (column) => column.stage.id === variables.toStageId,
      )?.stage;
      toast.success(`Moved ${variables.contactName} to ${stage?.name ?? "stage"}`);
    },
    onSettled: async () => invalidateAfterMutation(queryClient),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = String(event.active.id).replace(/^crm-card:/, "");
    // Keyboard drags haven't measured the active rect yet at start; fall
    // back to the lifted card's DOM node so the placeholder matches it.
    const measured =
      event.active.rect.current.initial?.height ??
      (event.activatorEvent.target instanceof Element
        ? (event.activatorEvent.target.closest("article")?.getBoundingClientRect().height ?? 0)
        : 0);
    setActiveHeight(measured);
    setActiveCard(
      workspace.pipeline.columns
        .flatMap((column) => column.cards)
        .find(({ card }) => card.id === cardId) ?? null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    if (event.over === null) return;
    const cardId = String(event.active.id).replace(/^crm-card:/, "");
    const toStageId = String(event.over.id).replace(/^crm-stage:/, "");
    const row = workspace.pipeline.columns
      .flatMap((column) => column.cards)
      .find(({ card }) => card.id === cardId);
    if (row === undefined || row.card.stageId === toStageId) return;
    move.mutate({
      cardId,
      toStageId,
      contactName: `${row.contact.firstName} ${row.contact.lastName}`,
    });
  };

  return (
    <DndContext
      id="crm-pipeline-dnd"
      sensors={sensors}
      collisionDetection={boardCollisions}
      // Hiding the source card and opening the placeholder gap both change
      // column heights mid-drag; drop rects must track that, not the layout
      // captured at drag start.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveCard(null)}
      onDragEnd={handleDragEnd}
    >
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
            <PipelineColumn
              key={column.stage.id}
              column={column}
              workspace={workspace}
              movingCardId={move.isPending ? move.variables.cardId : null}
              activeCard={activeCard}
              activeHeight={activeHeight}
              openContact={openContact}
              moveCard={(cardId, toStageId, contactName) =>
                move.mutate({ cardId, toStageId, contactName })
              }
            />
          ))}
        </div>
        {manageOpen ? (
          <ManageStagesDialog
            open
            onOpenChange={setManageOpen}
            stages={workspace.pipeline.columns.map((column) => column.stage)}
          />
        ) : null}
        {/* Mounted on demand so contact/stage state re-seeds from the fresh
            directory each open — a stale contactId from a prior add would
            silently re-enroll (and move) the previous contact. */}
        {addOpen ? <AddCardDialog open onOpenChange={setAddOpen} workspace={workspace} /> : null}
      </section>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeCard === null ? null : <PipelineCardPreview row={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}

function PipelineColumn({
  column,
  workspace,
  movingCardId,
  activeCard,
  activeHeight,
  openContact,
  moveCard,
}: {
  readonly column: CrmWorkspace["pipeline"]["columns"][number];
  readonly workspace: CrmWorkspace;
  readonly movingCardId: string | null;
  readonly activeCard: PipelineRow | null;
  readonly activeHeight: number;
  readonly openContact: (id: string) => void;
  readonly moveCard: (cardId: string, toStageId: string, contactName: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stageDndId(column.stage.id) });
  // Dropping on the origin column is a no-op, so it never advertises a slot.
  const showsPlaceholder =
    isOver && activeCard !== null && activeCard.card.stageId !== column.stage.id;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-60 rounded-lg border bg-muted/15 transition-colors",
        showsPlaceholder ? "border-primary/40 bg-muted/40" : "",
      )}
    >
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
        {column.cards.length === 0 && !showsPlaceholder ? (
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
              moving={movingCardId === card.id}
              moveCard={moveCard}
              open={() => openContact(contact.id)}
            />
          ))
        )}
        {/* The slot the card will land in — cards join at the end of the
            stage, so the gap opens exactly there, sized to the dragged card. */}
        {showsPlaceholder ? (
          <div
            className="pipeline-drop-slot rounded-md border border-dashed border-primary/50 bg-primary/5"
            style={{ height: activeHeight > 0 ? activeHeight : 64 }}
          />
        ) : null}
      </div>
    </div>
  );
}

// Rendered inside DragOverlay, which is sized to the lifted card's measured
// rect — filling it keeps the ghost exactly the card's own dimensions.
function PipelineCardPreview({ row }: { readonly row: PipelineRow }) {
  return (
    <div className="flex size-full cursor-grabbing items-start gap-2 rounded-md border bg-background p-2.5 shadow-lg ring-1 ring-primary/20">
      <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {row.contact.firstName} {row.contact.lastName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.contact.title ?? "No title"}
          {row.contact.company === null ? "" : ` · ${row.contact.company}`}
        </p>
        {row.card.note === null ? null : (
          <p className="mt-2 line-clamp-2 text-xs">{row.card.note}</p>
        )}
      </div>
    </div>
  );
}

function PipelineCard({
  workspace,
  card,
  contact,
  moving,
  moveCard,
  open,
}: {
  readonly workspace: CrmWorkspace;
  readonly card: CrmWorkspace["pipeline"]["columns"][number]["cards"][number]["card"];
  readonly contact: CrmWorkspace["directory"][number]["contact"];
  readonly moving: boolean;
  readonly moveCard: (cardId: string, toStageId: string, contactName: string) => void;
  readonly open: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardDndId(card.id),
  });
  const contactName = `${contact.firstName} ${contact.lastName}`;

  // Motion lives entirely in the DragOverlay clone; the source card stays
  // in layout as a dimmed slot (removing it would zero the rect dnd-kit
  // measures for the overlay) so the origin reads as "lifted from here".
  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group/card min-w-0 rounded-md border bg-background p-2.5 transition-opacity",
        isDragging ? "border-dashed opacity-30" : "",
        moving ? "opacity-60" : "",
      )}
    >
      {/* The drag handle is its own focusable button so keyboard users can
          both drag (Enter/Space + arrows on the grip) and open the contact
          (Enter on the card body) — one button can't do both. */}
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`Drag ${contactName} to another stage`}
          className="pressable mt-0.5 shrink-0 cursor-grab touch-none rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <button type="button" className="pressable min-w-0 flex-1 text-left" onClick={open}>
          <span className="block truncate font-medium">{contactName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {contact.title ?? "No title"}
            {contact.company === null ? "" : ` · ${contact.company}`}
          </span>
          {card.note === null ? null : (
            <span className="mt-2 block line-clamp-2 text-xs">{card.note}</span>
          )}
        </button>
        {/* Linear-style card menu: the keyboard/no-drag path to a stage
            move, revealed on hover or focus so cards stay clean. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Actions for ${contactName}`}
              className={cn(
                "-mt-0.5 -mr-1 shrink-0 text-muted-foreground opacity-0 transition-opacity",
                "group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
              )}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={open}>
              <UserRoundIcon /> Open contact
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightIcon className="size-3.5 text-muted-foreground" /> Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Stages</DropdownMenuLabel>
                {workspace.pipeline.columns.map((column) => (
                  <DropdownMenuItem
                    key={column.stage.id}
                    disabled={column.stage.id === card.stageId || moving}
                    onSelect={() => moveCard(card.id, column.stage.id, contactName)}
                  >
                    {column.stage.name}
                    <span className="ml-auto text-[11px] text-muted-foreground capitalize">
                      {column.stage.semanticStatus}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
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
      await invalidateAfterMutation(queryClient);
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
  const refresh = () => invalidateAfterMutation(queryClient);
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
