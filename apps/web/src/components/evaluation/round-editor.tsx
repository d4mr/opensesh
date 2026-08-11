import type {
  EvaluationAdminWorkspace,
  EvaluationResultRow,
  ReviewCriterionType,
  ReviewRoundAdminView,
} from "@opensesh/domain";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  EyeOffIcon,
  MailIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/forms/datetime-picker";
import { EntityCombobox } from "@/components/forms/entity-combobox";
import { PersonHoverCard } from "@/components/app/person-popover";
import { PersonTag } from "@/components/app/person-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminEvaluationQuery } from "@/lib/evaluation-queries";
import {
  addReviewMember,
  assignReviews,
  autoDistributeReviews,
  exportReviewResults,
  generateAiReview,
  overrideAiReview,
  saveReviewRound,
  sendReviewReminders,
  unassignReview,
} from "@/server-fns/reviews";

interface CriterionDraft {
  readonly key: string;
  readonly id: string | null;
  readonly label: string;
  readonly type: ReviewCriterionType;
  readonly min: number | null;
  readonly max: number | null;
  readonly options: ReadonlyArray<string>;
  readonly required: boolean;
  readonly weight: number;
}

interface RoundDraft {
  readonly name: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly blind: boolean;
  readonly position: number;
  readonly criteria: ReadonlyArray<CriterionDraft>;
}

const criterionDraft = (type: ReviewCriterionType): CriterionDraft => ({
  key: crypto.randomUUID(),
  id: null,
  label: "",
  type,
  min: type === "numeric" ? 1 : null,
  max: type === "numeric" ? 5 : null,
  options: type === "dropdown" ? ["Accept", "Maybe", "Reject"] : [],
  required: false,
  weight: type === "numeric" ? 1 : 1,
});

const roundDraft = (view: ReviewRoundAdminView | undefined, nextPosition: number): RoundDraft => {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 86_400_000);
  return {
    name: view?.configuration.round.name ?? "",
    opensAt: view?.configuration.round.opensAt.toISOString() ?? now.toISOString(),
    closesAt: view?.configuration.round.closesAt.toISOString() ?? later.toISOString(),
    blind: view?.configuration.round.blind ?? false,
    position: view?.configuration.round.position ?? nextPosition,
    criteria:
      view?.configuration.criteria.map((criterion) => ({
        key: criterion.id,
        id: criterion.id,
        label: criterion.label,
        type: criterion.type,
        min: criterion.min,
        max: criterion.max,
        options: criterion.options,
        required: criterion.required,
        weight: criterion.weight,
      })) ?? [],
  };
};

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

export function EvaluationRoundEditor({
  eventId,
  timezone,
  workspace,
  view,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly workspace: EvaluationAdminWorkspace;
  readonly view: ReviewRoundAdminView | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => roundDraft(view, workspace.rounds.length + 1));
  const [saving, setSaving] = useState(false);
  const roundId = view?.configuration.round.id ?? null;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminEvaluationQuery(eventId).queryKey });

  const updateCriterion = (key: string, update: Partial<CriterionDraft>) =>
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion) =>
        criterion.key === key ? { ...criterion, ...update } : criterion,
      ),
    }));
  const moveCriterion = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= draft.criteria.length) return;
    const criteria = [...draft.criteria];
    const current = criteria[index];
    const next = criteria[target];
    if (current === undefined || next === undefined) return;
    criteria[index] = next;
    criteria[target] = current;
    setDraft({ ...draft, criteria });
  };
  const save = async () => {
    setSaving(true);
    const result = await saveReviewRound({
      data: {
        eventId,
        roundId,
        name: draft.name,
        opensAt: draft.opensAt,
        closesAt: draft.closesAt,
        blind: draft.blind,
        position: draft.position,
        criteria: draft.criteria.map((criterion, index) => ({
          id: criterion.id,
          label: criterion.label,
          type: criterion.type,
          min: criterion.min,
          max: criterion.max,
          options: criterion.options,
          required: criterion.required,
          weight: criterion.weight,
          position: index + 1,
        })),
      },
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await refresh();
    toast.success("Saved round");
    if (roundId === null) {
      await navigate({
        to: "/admin/evaluation/$roundId",
        params: { roundId: result.data.roundId },
        replace: true,
      });
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col text-sm">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button asChild size="sm" variant="ghost" className="pressable -ml-1">
          <Link to="/admin/evaluation">
            <ArrowLeftIcon /> Evaluation
          </Link>
        </Button>
        <div className="min-w-0 border-l pl-3">
          <span className="block truncate text-xs font-medium">
            {draft.name.trim() || "Untitled round"}
          </span>
          <span className="block text-[11px] leading-3 text-muted-foreground">
            {roundId === null
              ? "New review round"
              : `${view?.configuration.round.status ?? "draft"} round`}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          className="pressable ml-auto"
          disabled={saving}
          onClick={() => void save()}
        >
          <SaveIcon /> {saving ? "Saving…" : "Save round"}
        </Button>
      </header>

      {roundId === null || view === undefined ? (
        <SetupPane
          draft={draft}
          setDraft={setDraft}
          timezone={timezone}
          updateCriterion={updateCriterion}
          moveCriterion={moveCriterion}
        />
      ) : (
        <Tabs defaultValue="setup" className="min-h-0 flex-1 gap-0">
          <div className="flex h-10 items-end border-b px-4 lg:px-6">
            <TabsList variant="line" className="h-9">
              <TabsTrigger value="setup" className="pressable h-9 text-xs">
                Setup
              </TabsTrigger>
              <TabsTrigger value="reviewers" className="pressable h-9 text-xs">
                Reviewers ({view.reviewers.length})
              </TabsTrigger>
              <TabsTrigger value="assignments" className="pressable h-9 text-xs">
                Assignments ({view.assignments.length})
              </TabsTrigger>
              <TabsTrigger value="progress" className="pressable h-9 text-xs">
                Progress
              </TabsTrigger>
              <TabsTrigger value="results" className="pressable h-9 text-xs">
                Results
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="setup" className="mt-0 min-h-0 overflow-y-auto">
            <SetupPane
              draft={draft}
              setDraft={setDraft}
              timezone={timezone}
              updateCriterion={updateCriterion}
              moveCriterion={moveCriterion}
            />
          </TabsContent>
          <TabsContent value="reviewers" className="mt-0 min-h-0 overflow-y-auto">
            <ReviewersPane eventId={eventId} view={view} refresh={refresh} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-0 min-h-0 overflow-y-auto">
            <AssignmentsPane
              eventId={eventId}
              workspace={workspace}
              view={view}
              refresh={refresh}
            />
          </TabsContent>
          <TabsContent value="progress" className="mt-0 min-h-0 overflow-y-auto">
            <ProgressPane eventId={eventId} view={view} refresh={refresh} />
          </TabsContent>
          <TabsContent value="results" className="mt-0 min-h-0 overflow-y-auto">
            <ResultsPane eventId={eventId} view={view} refresh={refresh} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}

function SetupPane({
  draft,
  setDraft,
  timezone,
  updateCriterion,
  moveCriterion,
}: {
  readonly draft: RoundDraft;
  readonly setDraft: (draft: RoundDraft) => void;
  readonly timezone: string;
  readonly updateCriterion: (key: string, update: Partial<CriterionDraft>) => void;
  readonly moveCriterion: (index: number, offset: -1 | 1) => void;
}) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(32rem,3fr)_minmax(24rem,2fr)]">
      <div className="min-w-0">
        <div className="mx-auto grid max-w-3xl gap-6 p-4 lg:p-6">
          <section>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Round details
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="round-name">Name</Label>
                <Input
                  id="round-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Opens</Label>
                <DateTimePicker
                  value={draft.opensAt}
                  timezone={timezone}
                  onChange={(opensAt) => setDraft({ ...draft, opensAt })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Closes</Label>
                <DateTimePicker
                  value={draft.closesAt}
                  timezone={timezone}
                  onChange={(closesAt) => setDraft({ ...draft, closesAt })}
                />
              </div>
              <div className="grid max-w-36 gap-1.5">
                <Label htmlFor="round-position">Position</Label>
                <Input
                  id="round-position"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.position}
                  onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })}
                />
              </div>
              <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 sm:col-span-2">
                <span>
                  <span className="block text-[13px] font-medium">Blind review</span>
                  <span className="block text-xs text-muted-foreground">
                    Hide participant identity and identifying profile data from reviewers.
                  </span>
                </span>
                <Switch
                  checked={draft.blind}
                  onCheckedChange={(blind) => setDraft({ ...draft, blind })}
                />
              </label>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Scorecard criteria
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.criteria.length} {plural(draft.criteria.length, "criterion", "criteria")}{" "}
                  in reviewer order
                </p>
              </div>
              <Select
                value=""
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    criteria: [
                      ...draft.criteria,
                      criterionDraft(value === "dropdown" || value === "text" ? value : "numeric"),
                    ],
                  })
                }
              >
                <SelectTrigger className="h-8 w-40">
                  <PlusIcon />
                  <SelectValue placeholder="Add criterion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric score</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="text">Long text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 grid gap-3">
              {draft.criteria.length === 0 ? (
                <div className="rounded-lg border px-4 py-8 text-center text-xs text-muted-foreground">
                  Add a criterion to build the reviewer scorecard.
                </div>
              ) : null}
              {draft.criteria.map((criterion, index) => (
                <div key={criterion.key} className="overflow-hidden rounded-lg border">
                  <div className="flex h-10 items-center border-b bg-muted/40 pl-3 pr-1.5">
                    <span className="text-[13px] font-medium">
                      Criterion {index + 1} ·{" "}
                      {criterion.type === "text"
                        ? "Long text"
                        : criterion.type === "dropdown"
                          ? "Dropdown"
                          : "Numeric"}
                    </span>
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="pressable"
                        disabled={index === 0}
                        aria-label={`Move criterion ${index + 1} up`}
                        onClick={() => moveCriterion(index, -1)}
                      >
                        <ChevronUpIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="pressable"
                        disabled={index === draft.criteria.length - 1}
                        aria-label={`Move criterion ${index + 1} down`}
                        onClick={() => moveCriterion(index, 1)}
                      >
                        <ChevronDownIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="pressable text-destructive hover:text-destructive"
                        aria-label={`Remove criterion ${index + 1}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            criteria: draft.criteria.filter((item) => item.key !== criterion.key),
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-3">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor={`${criterion.key}-label`}>Label</Label>
                      <Input
                        id={`${criterion.key}-label`}
                        value={criterion.label}
                        onChange={(event) =>
                          updateCriterion(criterion.key, { label: event.target.value })
                        }
                      />
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-xs font-medium">
                      <Switch
                        checked={criterion.required}
                        onCheckedChange={(required) => updateCriterion(criterion.key, { required })}
                      />{" "}
                      Required
                    </label>
                    {criterion.type === "numeric" ? (
                      <>
                        <div className="grid gap-1.5">
                          <Label>Minimum</Label>
                          <Input
                            type="number"
                            value={criterion.min ?? ""}
                            onChange={(event) =>
                              updateCriterion(criterion.key, { min: Number(event.target.value) })
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Maximum</Label>
                          <Input
                            type="number"
                            value={criterion.max ?? ""}
                            onChange={(event) =>
                              updateCriterion(criterion.key, { max: Number(event.target.value) })
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Weight</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step="any"
                            value={criterion.weight}
                            onChange={(event) =>
                              updateCriterion(criterion.key, { weight: Number(event.target.value) })
                            }
                          />
                        </div>
                      </>
                    ) : criterion.type === "dropdown" ? (
                      <div className="grid gap-2 sm:col-span-3">
                        <Label>Options</Label>
                        {criterion.options.map((option, optionIndex) => (
                          <div
                            key={`${criterion.key}-${optionIndex}`}
                            className="flex items-center gap-1.5"
                          >
                            <Input
                              value={option}
                              onChange={(event) =>
                                updateCriterion(criterion.key, {
                                  options: criterion.options.map((item, current) =>
                                    current === optionIndex ? event.target.value : item,
                                  ),
                                })
                              }
                            />
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="pressable"
                              disabled={optionIndex === 0}
                              aria-label={`Move option ${optionIndex + 1} up`}
                              onClick={() => {
                                const options = [...criterion.options];
                                const previous = options[optionIndex - 1];
                                if (previous === undefined) return;
                                options[optionIndex - 1] = option;
                                options[optionIndex] = previous;
                                updateCriterion(criterion.key, { options });
                              }}
                            >
                              <ChevronUpIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="pressable"
                              disabled={optionIndex === criterion.options.length - 1}
                              aria-label={`Move option ${optionIndex + 1} down`}
                              onClick={() => {
                                const options = [...criterion.options];
                                const next = options[optionIndex + 1];
                                if (next === undefined) return;
                                options[optionIndex + 1] = option;
                                options[optionIndex] = next;
                                updateCriterion(criterion.key, { options });
                              }}
                            >
                              <ChevronDownIcon />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="pressable text-destructive"
                              aria-label={`Remove option ${optionIndex + 1}`}
                              onClick={() =>
                                updateCriterion(criterion.key, {
                                  options: criterion.options.filter(
                                    (_, current) => current !== optionIndex,
                                  ),
                                })
                              }
                            >
                              <XIcon />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="pressable w-fit text-muted-foreground"
                          onClick={() =>
                            updateCriterion(criterion.key, { options: [...criterion.options, ""] })
                          }
                        >
                          <PlusIcon /> Add option
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <aside className="min-w-0 border-l bg-muted/20">
        <div className="sticky top-0 flex h-9 items-center border-b bg-background/95 px-3 text-xs text-muted-foreground">
          Preview — what reviewers see
        </div>
        <div className="mx-auto max-w-xl p-4 lg:p-6">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{draft.name.trim() || "Untitled round"}</h2>
              {draft.blind ? (
                <Badge variant="outline" className="gap-1">
                  <EyeOffIcon className="size-3" /> Blind
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reviewer scorecard · {draft.criteria.length}{" "}
              {plural(draft.criteria.length, "criterion", "criteria")}
            </p>
            <div className="mt-5 grid gap-4">
              {draft.criteria.map((criterion) => (
                <div key={criterion.key} className="grid gap-1.5">
                  <Label>
                    {criterion.label.trim() || "Untitled criterion"}
                    {criterion.required ? " *" : ""}
                  </Label>
                  {criterion.type === "numeric" ? (
                    <Input
                      disabled
                      placeholder={`${criterion.min ?? "—"} to ${criterion.max ?? "—"} · weight ${criterion.weight}`}
                    />
                  ) : criterion.type === "dropdown" ? (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an option" />
                      </SelectTrigger>
                    </Select>
                  ) : (
                    <Textarea disabled className="min-h-20" placeholder="Reviewer response" />
                  )}
                </div>
              ))}
              {draft.criteria.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add criteria to see the reviewer form.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReviewersPane({
  eventId,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [cap, setCap] = useState("5");
  const [adding, setAdding] = useState(false);
  const [access, setAccess] = useState<{
    readonly email: string;
    readonly path: string;
    readonly reused: boolean;
  }>();
  const add = async () => {
    setAdding(true);
    const accessPath = `${window.location.origin}/login`;
    const result = await addReviewMember({
      data: {
        eventId,
        roundId: view.configuration.round.id,
        email,
        assignmentCap: cap.length === 0 ? null : Number(cap),
        accessPath,
      },
    });
    setAdding(false);
    if (!result.ok) return toast.error(result.error.message);
    setAccess({
      email: result.data.reviewer.email,
      path: result.data.accessPath,
      reused: result.data.alreadyInPool,
    });
    setEmail("");
    await refresh();
    toast.success(result.data.alreadyInPool ? "Reused reviewer in this round" : "Added 1 reviewer");
  };
  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-semibold">Reviewer pool</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.reviewers.length} {plural(view.reviewers.length, "reviewer")} in this round only
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="reviewer-email">Reviewer email</Label>
          <Input
            id="reviewer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="sam.reviewer@example.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reviewer-cap">Assignment cap</Label>
          <Input
            id="reviewer-cap"
            type="number"
            min={1}
            value={cap}
            onChange={(event) => setCap(event.target.value)}
          />
        </div>
        <Button
          className="pressable self-end"
          disabled={adding || email.length === 0}
          onClick={() => void add()}
        >
          <UserPlusIcon /> {adding ? "Adding…" : "Add reviewer"}
        </Button>
      </div>
      {access === undefined ? null : (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <CheckIcon className="size-4 text-primary" />
            <p className="text-[13px] font-medium">
              {access.reused ? "Reviewer already matched" : "Reviewer access ready"}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {access.email} can sign in using this copyable access path.
          </p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={access.path} aria-label="Reviewer access path" />
            <Button
              variant="outline"
              className="pressable"
              onClick={() => {
                void navigator.clipboard.writeText(access.path);
                toast.success("Copied reviewer access path");
              }}
            >
              <CopyIcon /> Copy
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-hidden rounded-lg border">
        {view.reviewers.map((reviewer) => (
          <ReviewerRow
            key={reviewer.member.id}
            eventId={eventId}
            roundId={view.configuration.round.id}
            reviewer={reviewer}
            refresh={refresh}
          />
        ))}
        {view.reviewers.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Add a reviewer to build this round’s pool.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ReviewerRow({
  eventId,
  roundId,
  reviewer,
  refresh,
}: {
  readonly eventId: string;
  readonly roundId: string;
  readonly reviewer: ReviewRoundAdminView["reviewers"][number];
  readonly refresh: () => Promise<unknown>;
}) {
  const [cap, setCap] = useState(reviewer.member.assignmentCap?.toString() ?? "");
  const save = async () => {
    const result = await addReviewMember({
      data: {
        eventId,
        roundId,
        email: reviewer.email,
        assignmentCap: cap.length === 0 ? null : Number(cap),
        accessPath: `${window.location.origin}/login`,
      },
    });
    if (!result.ok) return toast.error(result.error.message);
    await refresh();
    toast.success("Saved assignment cap");
  };
  return (
    <div className="flex min-h-12 items-center gap-3 border-b px-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{reviewer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{reviewer.email}</p>
      </div>
      <Label className="text-xs text-muted-foreground" htmlFor={`${reviewer.member.id}-cap`}>
        Cap
      </Label>
      <Input
        id={`${reviewer.member.id}-cap`}
        className="h-8 w-20"
        type="number"
        min={1}
        placeholder="None"
        value={cap}
        onChange={(event) => setCap(event.target.value)}
      />
      <Button size="sm" variant="outline" className="pressable" onClick={() => void save()}>
        Save cap
      </Button>
    </div>
  );
}

function AssignmentsPane({
  eventId,
  workspace,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly workspace: EvaluationAdminWorkspace;
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const [trackId, setTrackId] = useState("all");
  const [reviewerId, setReviewerId] = useState(view.reviewers[0]?.member.eventMemberId ?? "");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmAssignment, setConfirmAssignment] =
    useState<ReviewRoundAdminView["assignments"][number]>();
  const reviewerItems = useMemo(
    () =>
      view.reviewers.map((reviewer) => ({
        ...reviewer,
        id: reviewer.member.eventMemberId,
      })),
    [view.reviewers],
  );
  const filtered = view.submissions.filter(
    (submission) => trackId === "all" || submission.trackIds.includes(trackId),
  );
  const pages = usePagination(filtered, { resetKey: trackId, getId: (item) => item.id });
  const mutate = async (mode: "assign" | "auto") => {
    const result =
      mode === "assign"
        ? await assignReviews({
            data: {
              eventId,
              roundId: view.configuration.round.id,
              eventMemberId: reviewerId,
              submissionIds: [...selected],
            },
          })
        : await autoDistributeReviews({
            data: {
              eventId,
              roundId: view.configuration.round.id,
              trackIds: trackId === "all" ? [] : [trackId],
            },
          });
    if (!result.ok) return toast.error(result.error.message);
    setSelected(new Set());
    await refresh();
    toast.success(`Assigned ${result.data.assigned} ${plural(result.data.assigned, "submission")}`);
  };
  const unassign = async () => {
    if (confirmAssignment === undefined) return;
    const result = await unassignReview({
      data: { eventId, roundId: view.configuration.round.id, assignmentId: confirmAssignment.id },
    });
    if (!result.ok) return toast.error(result.error.message);
    setConfirmAssignment(undefined);
    await refresh();
    toast.success("Unassigned 1 submission");
  };
  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Assignments</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length} of {view.submissions.length} submissions · {view.assignments.length}{" "}
            assignments
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={trackId} onValueChange={setTrackId}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tracks</SelectItem>
              {workspace.tracks.map((track) => (
                <SelectItem key={track.id} value={track.id}>
                  {track.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trackId === "all" ? null : (
            <Button
              size="sm"
              variant="ghost"
              className="pressable"
              onClick={() => setTrackId("all")}
            >
              <XIcon /> Clear filters
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            disabled={view.reviewers.length === 0}
            onClick={() => void mutate("auto")}
          >
            <ArrowUpDownIcon /> Auto-distribute
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <EntityCombobox
          items={reviewerItems}
          value={reviewerId}
          onChange={setReviewerId}
          getItemText={(reviewer) => `${reviewer.name} ${reviewer.email}`}
          placeholder="Choose reviewer"
          searchPlaceholder="Search reviewers…"
          emptyText="No reviewers found."
          className="h-8 w-56"
          contentClassName="w-72"
          renderValue={(reviewer) => <PersonTag person={{ name: reviewer.name, image: null }} />}
          renderItem={(reviewer) => (
            <PersonHoverCard
              side="right"
              person={{
                name: reviewer.name,
                image: null,
                title: reviewer.email,
                company: null,
                bio: null,
                status: null,
              }}
            >
              <div className="min-w-0">
                <PersonTag person={{ name: reviewer.name, image: null }} />
                <p className="mt-0.5 truncate pl-5.5 text-xs text-muted-foreground">
                  {reviewer.email}
                </p>
              </div>
            </PersonHoverCard>
          )}
        />
        <Button
          size="sm"
          className="pressable"
          disabled={selected.size === 0 || reviewerId.length === 0}
          onClick={() => void mutate("assign")}
        >
          Assign selected ({selected.size})
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="h-8">
              <TableHead className="h-8 w-10">
                <Checkbox
                  aria-label="Select all filtered submissions"
                  checked={
                    filtered.length > 0 &&
                    filtered.every((submission) => selected.has(submission.id))
                  }
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked ? new Set(filtered.map((submission) => submission.id)) : new Set(),
                    )
                  }
                />
              </TableHead>
              <TableHead className="h-8 w-24 text-xs">Code</TableHead>
              <TableHead className="h-8 text-xs">Submission</TableHead>
              <TableHead className="h-8 text-xs">Track</TableHead>
              <TableHead className="h-8 text-xs">Assignment state</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.pageItems.map((submission) => {
              const assignments = view.assignments.filter(
                (assignment) => assignment.submissionId === submission.id,
              );
              return (
                <TableRow key={submission.id} className="h-10">
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${submission.code}`}
                      checked={selected.has(submission.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked) next.add(submission.id);
                          else next.delete(submission.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {submission.code}
                  </TableCell>
                  <TableCell>
                    <p className="text-[13px] font-medium">{submission.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.participants
                        .map((participant) => `${participant.name} (${participant.role})`)
                        .join("; ")}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{submission.trackNames.join(", ")}</TableCell>
                  <TableCell>
                    {assignments.length === 0 ? (
                      <Badge variant="outline">Unassigned</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {assignments.map((assignment) => {
                          const reviewer = view.reviewers.find(
                            (item) => item.member.eventMemberId === assignment.eventMemberId,
                          );
                          return (
                            <span
                              key={assignment.id}
                              className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-1.5 py-1 text-xs"
                            >
                              {reviewer?.name ?? "Reviewer"} · {assignment.status}
                              <button
                                type="button"
                                className="pressable text-muted-foreground hover:text-destructive"
                                aria-label={`Unassign ${submission.code} from ${reviewer?.name ?? "reviewer"}`}
                                onClick={() => setConfirmAssignment(assignment)}
                              >
                                <XIcon className="size-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationFooter
          page={pages.page}
          pageSize={pages.pageSize}
          total={filtered.length}
          onPageChange={pages.setPage}
        />
      </div>
      <Dialog
        open={confirmAssignment !== undefined}
        onOpenChange={(open) => {
          if (!open) setConfirmAssignment(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign this review?</DialogTitle>
            <DialogDescription>
              The assignment and any stored answers will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAssignment(undefined)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void unassign()}>
              Unassign review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressPane({
  eventId,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const pages = usePagination(view.progress, { getId: (row) => row.eventMemberId });
  const send = async () => {
    const result = await sendReviewReminders({
      data: { eventId, roundId: view.configuration.round.id, eventMemberIds: [...selected] },
    });
    if (!result.ok) return toast.error(result.error.message);
    setSelected(new Set());
    await refresh();
    toast.success(`Sent ${result.data.sent} ${plural(result.data.sent, "reminder")}`);
  };
  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-semibold">Review progress</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.progress.length} {plural(view.progress.length, "reviewer")} · recused assignments
            excluded from the completion denominator
          </p>
        </div>
        <Button
          size="sm"
          className="pressable"
          disabled={selected.size === 0}
          onClick={() => void send()}
        >
          <MailIcon /> Send reminders ({selected.size})
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="h-8">
              <TableHead className="h-8 w-10" />
              <TableHead className="h-8 text-xs">Reviewer</TableHead>
              <TableHead className="h-8 text-right text-xs">Assigned</TableHead>
              <TableHead className="h-8 text-right text-xs">Completed</TableHead>
              <TableHead className="h-8 text-right text-xs">Recused</TableHead>
              <TableHead className="h-8 text-right text-xs">Remaining</TableHead>
              <TableHead className="h-8 w-44 text-xs">Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.pageItems.map((row) => (
              <TableRow key={row.eventMemberId} className="h-10">
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${row.name} for reminder`}
                    disabled={row.remaining === 0}
                    checked={selected.has(row.eventMemberId)}
                    onCheckedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(row.eventMemberId);
                        else next.delete(row.eventMemberId);
                        return next;
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <p className="text-[13px] font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.assigned}</TableCell>
                <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                <TableCell className="text-right tabular-nums">{row.recused}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.remaining}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full bg-primary"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums">{row.percentage}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationFooter
          page={pages.page}
          pageSize={pages.pageSize}
          total={view.progress.length}
          onPageChange={pages.setPage}
        />
      </div>
    </div>
  );
}

function ResultsPane({
  eventId,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [generating, setGenerating] = useState<string>();
  const [aiErrors, setAiErrors] = useState<Readonly<Record<string, string>>>({});
  const ordered = view.results
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row.weightedAggregate;
      const b = right.row.weightedAggregate;
      if (a === null && b === null) return left.index - right.index;
      if (a === null) return 1;
      if (b === null) return -1;
      const difference = direction === "asc" ? a - b : b - a;
      return difference || left.index - right.index;
    })
    .map(({ row }) => row);
  const pages = usePagination(ordered, {
    resetKey: direction,
    getId: (row) => row.submission.id,
  });
  const download = async () => {
    const response = await exportReviewResults({
      data: { eventId, roundId: view.configuration.round.id },
    });
    if (!response.ok) return toast.error(await response.text());
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `evaluation-${view.configuration.round.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${view.results.length} ${plural(view.results.length, "submission")}`);
  };
  const generate = async (submissionId: string) => {
    setGenerating(submissionId);
    const result = await generateAiReview({
      data: { eventId, roundId: view.configuration.round.id, submissionId },
    });
    setGenerating(undefined);
    if (!result.ok) {
      setAiErrors((current) => ({ ...current, [submissionId]: result.error.message }));
      return toast.error(result.error.message);
    }
    setAiErrors((current) => {
      const next = { ...current };
      delete next[submissionId];
      return next;
    });
    await refresh();
    toast.success("Generated AI first-pass review");
  };
  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Round results</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.results.length} {plural(view.results.length, "submission")} · weighted numeric
            criteria
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            onClick={() => setDirection((current) => (current === "asc" ? "desc" : "asc"))}
          >
            {direction === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />} Aggregate{" "}
            {direction === "asc" ? "ascending" : "descending"}
          </Button>
          <Button size="sm" variant="outline" className="pressable" onClick={() => void download()}>
            <DownloadIcon /> Export CSV
          </Button>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="h-8">
              <TableHead className="h-8 min-w-72 text-xs">Submission</TableHead>
              {view.configuration.criteria.map((criterion) => (
                <TableHead key={criterion.id} className="h-8 min-w-28 text-xs">
                  {criterion.label}
                </TableHead>
              ))}
              <TableHead className="h-8 min-w-32 text-xs">
                Weighted aggregate {direction === "asc" ? "↑" : "↓"}
              </TableHead>
              <TableHead className="h-8 min-w-28 text-xs">Recommendation</TableHead>
              <TableHead className="h-8 min-w-28 text-xs">Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.pageItems.map((row) => (
              <ResultsRows
                key={row.submission.id}
                eventId={eventId}
                row={row}
                view={view}
                generating={generating === row.submission.id}
                aiError={aiErrors[row.submission.id]}
                generate={() => void generate(row.submission.id)}
                refresh={refresh}
              />
            ))}
          </TableBody>
        </Table>
        <PaginationFooter
          page={pages.page}
          pageSize={pages.pageSize}
          total={ordered.length}
          onPageChange={pages.setPage}
        />
      </div>
    </div>
  );
}

function ResultsRows({
  eventId,
  row,
  view,
  generating,
  aiError,
  generate,
  refresh,
}: {
  readonly eventId: string;
  readonly row: EvaluationResultRow;
  readonly view: ReviewRoundAdminView;
  readonly generating: boolean;
  readonly aiError: string | undefined;
  readonly generate: () => void;
  readonly refresh: () => Promise<unknown>;
}) {
  return (
    <>
      <TableRow className="h-10">
        <TableCell>
          <p className="text-[13px] font-medium">
            <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
              {row.submission.code}
            </span>
            {row.submission.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.submission.participants
              .map((participant) => `${participant.name} (${participant.role})`)
              .join("; ")}
          </p>
        </TableCell>
        {view.configuration.criteria.map((criterion) => (
          <TableCell key={criterion.id} className="text-xs">
            {Array.from(
              new Set(
                row.humanReviews.flatMap((review) =>
                  review.answers.flatMap((answer) =>
                    answer.criterionId === criterion.id
                      ? [
                          answer.numericValue?.toString() ??
                            answer.optionValue ??
                            answer.textValue ??
                            "—",
                        ]
                      : [],
                  ),
                ),
              ),
            ).join("; ") || "—"}
          </TableCell>
        ))}
        <TableCell className="font-medium tabular-nums">
          {row.weightedAggregate?.toFixed(2) ?? "—"}
        </TableCell>
        <TableCell>{row.recommendation ?? "—"}</TableCell>
        <TableCell className="tabular-nums">
          {row.completedCount}/{row.reviewerCount}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={view.configuration.criteria.length + 4} className="bg-muted/10 p-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Human reviews · {row.humanReviews.length}</p>
              </div>
              {row.humanReviews.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No human reviews assigned.</p>
              ) : (
                <div className="mt-2 divide-y">
                  {row.humanReviews.map((review) => (
                    <div key={review.assignment.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{review.reviewerName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {review.assignment.status}
                        </Badge>
                      </div>
                      {review.assignment.recusalReason === null ? null : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Recusal: {review.assignment.recusalReason}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {review.answers
                          .map(
                            (answer) =>
                              `${answer.label}: ${answer.numericValue ?? answer.optionValue ?? answer.textValue ?? "—"}`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <BotIcon className="size-4 text-primary" />
                <p className="text-xs font-semibold">AI first-pass</p>
                <Badge className="bg-primary text-primary-foreground">AI</Badge>
                {row.aiResult === null ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="pressable ml-auto"
                    disabled={generating}
                    onClick={generate}
                  >
                    <SparklesIcon /> {generating ? "Generating…" : "Run AI review"}
                  </Button>
                ) : null}
              </div>
              {row.aiResult === null ? (
                aiError === undefined ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No AI review generated. A configured Anthropic key is required; failures are
                    shown without fabricated output.
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                    {aiError}
                  </p>
                )
              ) : (
                <AiResult eventId={eventId} row={row} refresh={refresh} />
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

function AiResult({
  eventId,
  row,
  refresh,
}: {
  readonly eventId: string;
  readonly row: EvaluationResultRow;
  readonly refresh: () => Promise<unknown>;
}) {
  const ai = row.aiResult;
  const [score, setScore] = useState(ai?.overriddenScore?.toString() ?? "");
  const [reason, setReason] = useState(ai?.overrideReason ?? "");
  if (ai === null) return null;
  const save = async () => {
    const result = await overrideAiReview({
      data: { eventId, resultId: ai.id, score: Number(score), reason },
    });
    if (!result.ok) return toast.error(result.error.message);
    await refresh();
    toast.success("Overrode AI score");
  };
  return (
    <div className="mt-2">
      <p className="text-xs">
        <span className="font-semibold tabular-nums">Original AI score {ai.score}</span> ·{" "}
        {ai.provider}/{ai.model}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{ai.reasoning}</p>
      {ai.overriddenScore === null ? null : (
        <p className="mt-2 text-xs font-medium">
          Human override {ai.overriddenScore} · {row.aiOverriddenByName ?? "Organizer"}
          <span className="block font-normal text-muted-foreground">{ai.overrideReason}</span>
        </p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
        <Input
          type="number"
          step="any"
          placeholder="Score"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />
        <Input
          placeholder="Override reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button
          size="sm"
          className="pressable"
          disabled={score.length === 0 || reason.trim().length === 0}
          onClick={() => void save()}
        >
          Override score
        </Button>
      </div>
    </div>
  );
}
