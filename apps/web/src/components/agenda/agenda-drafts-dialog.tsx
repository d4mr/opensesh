import {
  GenerateAgendaDraftRequest,
  type AgendaAdminData,
  type AgendaDraft,
  type AgendaDraftCriteria,
  type GenerateAgendaDraftRequest as GenerateAgendaDraftRequestData,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleMinusIcon,
  CopyIcon,
  EllipsisIcon,
  LoaderIcon,
  PlusIcon,
  Trash2Icon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Timestamp } from "@/components/app/timestamp";
import { TimezoneChip } from "@/components/app/timezone-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { eventDateKeys, formatLongDay, minuteLabel } from "./date-utils";

const CANVAS_START = 8 * 60;
const CANVAS_END = 19 * 60;
const timeOptions = (from: number, to: number) =>
  Array.from({ length: (to - from) / 30 + 1 }, (_, index) => from + index * 30);

const statusStyles = {
  draft: {
    icon: CircleDashedIcon,
    className: "bg-[var(--status-draft)] text-[var(--status-draft-foreground)]",
  },
  generated: {
    icon: LoaderIcon,
    className: "bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
  },
  committed: {
    icon: CircleCheckIcon,
    className: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  },
  discarded: {
    icon: CircleMinusIcon,
    className: "bg-[var(--status-withdrawn)] text-[var(--status-withdrawn-foreground)]",
  },
} as const;

function DraftStatus({ draft }: { readonly draft: AgendaDraft }) {
  const style = statusStyles[draft.status];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${style.className}`}
    >
      <Icon className="size-3" />
      {draft.status}
    </span>
  );
}

function DraftList({
  drafts,
  timezone,
  compare,
  continueSetup,
  duplicate,
  discard,
}: {
  readonly drafts: ReadonlyArray<AgendaDraft>;
  readonly timezone: string;
  readonly compare: (draftId: string) => void;
  readonly continueSetup: (draft: AgendaDraft) => void;
  readonly duplicate: (draft: AgendaDraft) => void;
  readonly discard: (draft: AgendaDraft) => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
        <div className="wizard-pop flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WandSparklesIcon className="size-5" />
        </div>
        <h3 className="mt-4 text-sm font-semibold tracking-tight">No drafts yet</h3>
        <p className="mt-1 max-w-72 text-xs text-muted-foreground">
          Auto-schedule builds a conflict-free proposal you review and accept — the live agenda
          never changes on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="m-4 overflow-hidden rounded-lg border">
      <div className="divide-y">
        {drafts.map((draft) => (
          <div key={draft.id} className="flex items-center transition-colors hover:bg-muted/50">
            <button
              type="button"
              disabled={draft.status !== "generated" && draft.status !== "draft"}
              className="pressable-row min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-default"
              onClick={() =>
                draft.status === "generated" ? compare(draft.id) : continueSetup(draft)
              }
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{draft.name}</span>
                <DraftStatus draft={draft} />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {draft.generatedAt === null ? (
                  draft.status === "draft" ? (
                    "Not generated — open to finish setup"
                  ) : (
                    "Not generated"
                  )
                ) : (
                  <>
                    <Timestamp value={draft.generatedAt} timezone={timezone} /> ·{" "}
                    {draft.proposal.placements.length} placements
                  </>
                )}
              </p>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="pressable mr-2"
                  aria-label={`Actions for ${draft.name}`}
                >
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => duplicate(draft)}>
                  <CopyIcon /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={draft.status === "committed" || draft.status === "discarded"}
                  onSelect={() => discard(draft)}
                >
                  <Trash2Icon /> Discard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}

function CriteriaForm({
  agenda,
  seed,
  generate,
  cancel,
}: {
  readonly agenda: AgendaAdminData;
  readonly seed: { readonly name: string; readonly criteria: AgendaDraftCriteria } | undefined;
  readonly generate: (input: GenerateAgendaDraftRequestData) => Promise<void>;
  readonly cancel: () => void;
}) {
  const [ruleText, setRuleText] = useState("");
  const days = eventDateKeys(agenda.event.startsAt, agenda.event.endsAt, agenda.event.timezone);
  const defaults: GenerateAgendaDraftRequestData = {
    eventId: agenda.event.id,
    name: seed?.name ?? "",
    criteria:
      seed === undefined
        ? {
            days,
            roomIds: agenda.rooms.map((room) => room.id),
            includeStatuses: ["accepted"],
            dayStartMinutes: CANVAS_START,
            dayEndMinutes: CANVAS_END,
            respectExistingPlacements: false,
            rules: [],
          }
        : {
            ...seed.criteria,
            days: seed.criteria.days.filter((day) => days.includes(day)),
            roomIds: seed.criteria.roomIds.filter((id) =>
              agenda.rooms.some((room) => room.id === id),
            ),
          },
  };
  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: Schema.toStandardSchemaV1(GenerateAgendaDraftRequest) },
    onSubmit: ({ value }) => generate(value),
  });

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="wizard-fields min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-xs">
                Draft name
              </Label>
              <Input
                id={field.name}
                autoFocus
                className="h-8 text-xs"
                placeholder="Balanced v1"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="criteria.days">
            {(field) => (
              <fieldset>
                <legend className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Days
                </legend>
                <div className="mt-1.5 grid gap-0.5 rounded-lg border p-1.5">
                  {days.map((day) => {
                    const checked = field.state.value.includes(day);
                    return (
                      <label
                        key={day}
                        className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${checked ? "bg-muted" : "hover:bg-muted/60"}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.handleChange(
                              next === true
                                ? [...field.state.value, day]
                                : field.state.value.filter((value) => value !== day),
                            )
                          }
                        />
                        {formatLongDay(day)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </form.Field>

          <form.Field name="criteria.roomIds">
            {(field) => (
              <fieldset>
                <legend className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Rooms
                </legend>
                <div className="mt-1.5 grid gap-0.5 rounded-lg border p-1.5">
                  {agenda.rooms.map((room) => {
                    const checked = field.state.value.includes(room.id);
                    return (
                      <label
                        key={room.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${checked ? "bg-muted" : "hover:bg-muted/60"}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.handleChange(
                              next === true
                                ? [...field.state.value, room.id]
                                : field.state.value.filter((value) => value !== room.id),
                            )
                          }
                        />
                        {room.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </form.Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="criteria.dayStartMinutes">
            {(field) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.name} className="text-xs">
                    First session starts
                  </Label>
                  <TimezoneChip timezone={agenda.event.timezone} />
                </div>
                <Select
                  value={String(field.state.value ?? CANVAS_START)}
                  onValueChange={(value) => {
                    const minutes = Number(value);
                    field.handleChange(minutes);
                    if ((form.getFieldValue("criteria.dayEndMinutes") ?? CANVAS_END) <= minutes) {
                      form.setFieldValue(
                        "criteria.dayEndMinutes",
                        Math.min(minutes + 60, CANVAS_END),
                      );
                    }
                  }}
                >
                  <SelectTrigger id={field.name} size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions(CANVAS_START, CANVAS_END - 60).map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minuteLabel(minutes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="criteria.dayEndMinutes">
            {(field) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.name} className="text-xs">
                    Last session ends by
                  </Label>
                  <TimezoneChip timezone={agenda.event.timezone} />
                </div>
                <Select
                  value={String(field.state.value ?? CANVAS_END)}
                  onValueChange={(value) => {
                    const minutes = Number(value);
                    field.handleChange(minutes);
                    if (
                      (form.getFieldValue("criteria.dayStartMinutes") ?? CANVAS_START) >= minutes
                    ) {
                      form.setFieldValue(
                        "criteria.dayStartMinutes",
                        Math.max(minutes - 60, CANVAS_START),
                      );
                    }
                  }}
                >
                  <SelectTrigger id={field.name} size="sm" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions(CANVAS_START + 60, CANVAS_END).map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minuteLabel(minutes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Statuses
            </p>
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted p-2 text-xs">
              <Checkbox checked disabled /> Accepted
              <span className="ml-auto text-[11px] text-muted-foreground">Schedule eligible</span>
            </div>
          </div>

          <form.Field name="criteria.respectExistingPlacements">
            {(field) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border p-2">
                <div>
                  <Label htmlFor={field.name} className="text-xs">
                    Respect existing placements
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Keep scheduled sessions where legal.
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field name="criteria.rules">
          {(field) => {
            const addRule = () => {
              const rule = ruleText.trim();
              if (rule === "" || field.state.value.includes(rule)) return;
              field.handleChange([...field.state.value, rule]);
              setRuleText("");
            };
            return (
              <div className="space-y-1.5">
                <Label htmlFor={field.name} className="text-xs">
                  Rules
                  {agenda.aiConfigured ? null : (
                    <span className="font-normal text-muted-foreground">— needs AI</span>
                  )}
                </Label>
                <div
                  className={cn("rounded-lg border p-1.5", !agenda.aiConfigured && "bg-muted/40")}
                >
                  {field.state.value.length === 0 ? null : (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {field.state.value.map((rule) => (
                        <Badge
                          key={rule}
                          variant="secondary"
                          className="gap-1 rounded-md text-[11px]"
                        >
                          {rule}
                          <button
                            type="button"
                            className="pressable rounded-sm"
                            aria-label={`Remove ${rule}`}
                            onClick={() =>
                              field.handleChange(
                                field.state.value.filter((value) => value !== rule),
                              )
                            }
                          >
                            <XIcon className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Input
                      id={field.name}
                      disabled={!agenda.aiConfigured}
                      className="h-7 border-0 px-1 text-xs shadow-none focus-visible:ring-0"
                      value={ruleText}
                      placeholder={
                        agenda.aiConfigured
                          ? "keynotes in Hall A morning"
                          : "Connect Anthropic to write rules"
                      }
                      onChange={(event) => setRuleText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== ",") return;
                        event.preventDefault();
                        addRule();
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="pressable"
                      aria-label="Add rule"
                      disabled={!agenda.aiConfigured}
                      onClick={addRule}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {agenda.aiConfigured
                    ? "Plain language, interpreted by Claude — the solver still verifies every placement. Try “no workshops before 10am”."
                    : "Rules are interpreted by Claude, and no Anthropic API key is configured for this workspace. Set ANTHROPIC_API_KEY to enable them."}
                </p>
              </div>
            );
          }}
        </form.Field>
      </div>

      <div className="flex flex-col gap-2 border-t p-4">
        <form.Subscribe
          selector={(state) => [
            state.canSubmit,
            state.isSubmitting,
            state.values.name.trim().length > 0 &&
              state.values.criteria.days.length > 0 &&
              state.values.criteria.roomIds.length > 0,
          ]}
        >
          {([canSubmit, isSubmitting, hasRequiredCriteria]) => (
            <>
              <span className="text-[11px] text-muted-foreground" aria-live="polite">
                {isSubmitting
                  ? agenda.aiConfigured
                    ? "Asking Claude · solving constraints · validating conflicts"
                    : "Loading sessions · solving constraints · validating conflicts"
                  : "The live agenda stays unchanged until accept."}
              </span>
              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                  Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || !hasRequiredCriteria || isSubmitting}
                >
                  <WandSparklesIcon /> {isSubmitting ? "Generating…" : "Generate"}
                </Button>
              </div>
            </>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

type DialogMode =
  | { readonly kind: "list" }
  | {
      readonly kind: "new";
      readonly seed?: { readonly name: string; readonly criteria: AgendaDraftCriteria };
    };

export function AgendaDraftsDialog({
  open,
  onOpenChange,
  agenda,
  drafts,
  generate,
  compare,
  discard,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly agenda: AgendaAdminData;
  readonly drafts: ReadonlyArray<AgendaDraft>;
  readonly generate: (input: GenerateAgendaDraftRequestData) => Promise<void>;
  readonly compare: (draftId: string) => void;
  readonly discard: (draft: AgendaDraft) => void;
}) {
  const [mode, setMode] = useState<DialogMode>({ kind: "list" });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setMode({ kind: "list" });
      }}
    >
      <DialogContent
        className={cn(
          "flex max-h-[85svh] flex-col gap-0 p-0",
          mode.kind === "new" ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <DialogHeader className="m-0 border-b p-4 text-left">
          <div className="flex items-start justify-between gap-4 pr-7">
            <div>
              <DialogTitle>
                {mode.kind === "list" ? "Auto-schedule" : (mode.seed?.name ?? "New draft")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {mode.kind === "list"
                  ? agenda.aiConfigured
                    ? "A greedy constraint solver places sessions conflict-free; Claude interprets your natural-language rules."
                    : "A greedy constraint solver places sessions into conflict-free slots."
                  : "Choose the scope and constraints for this proposal."}
              </DialogDescription>
            </div>
            {mode.kind === "list" ? (
              <Button size="sm" className="pressable" onClick={() => setMode({ kind: "new" })}>
                <PlusIcon /> New draft
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        {mode.kind === "list" ? (
          <DraftList
            drafts={drafts}
            timezone={agenda.event.timezone}
            compare={compare}
            continueSetup={(draft) =>
              setMode({ kind: "new", seed: { name: draft.name, criteria: draft.criteria } })
            }
            duplicate={(draft) =>
              setMode({
                kind: "new",
                seed: { name: `${draft.name} copy`, criteria: draft.criteria },
              })
            }
            discard={discard}
          />
        ) : (
          <CriteriaForm
            agenda={agenda}
            seed={mode.seed}
            generate={generate}
            cancel={() => setMode({ kind: "list" })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
