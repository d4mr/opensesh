import type {
  ReviewAssignmentBatch,
  EvaluationAdminWorkspace,
  EvaluationResultRow,
  ReviewCriterionType,
  ReviewRoundAdminView,
} from "@opensesh/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  MailIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditorHeader } from "@/components/app/editor-header";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { SpotlightLayout, SpotlightPanelHeader } from "@/components/app/spotlight";
import { StatusBadge, statusTextClass } from "@/components/app/status-badge";
import { Timestamp } from "@/components/app/timestamp";
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
  TableShell,
} from "@/components/ui/table";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { reviewerTracksQuery } from "@/lib/evaluation-queries";
import { cn } from "@/lib/utils";
import {
  addReviewMember,
  assignReviews,
  autoDistributeReviews,
  exportReviewResults,
  generateAiReview,
  overrideAiReview,
  saveReviewRound,
  sendReviewReminders,
  setReviewerTracks,
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
  readonly reviewsPerSubmission: number;
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
    reviewsPerSubmission: view?.configuration.round.reviewsPerSubmission ?? 2,
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
  const refresh = () => invalidateAfterMutation(queryClient, eventId);

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
        reviewsPerSubmission: draft.reviewsPerSubmission,
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
      <EditorHeader
        backTo="/admin/evaluation"
        backLabel="Evaluation"
        title={draft.name.trim() || "Untitled round"}
        subtitle={
          roundId === null
            ? "New review round"
            : `${view?.configuration.round.status ?? "draft"} round`
        }
      >
        <Button
          type="button"
          size="sm"
          className="pressable"
          disabled={saving}
          onClick={() => void save()}
        >
          <SaveIcon /> {saving ? "Saving…" : "Save round"}
        </Button>
      </EditorHeader>

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
            <ReviewersPane
              eventId={eventId}
              tracks={workspace.tracks}
              view={view}
              refresh={refresh}
            />
          </TabsContent>
          <TabsContent value="assignments" className="mt-0 flex min-h-0 flex-1 flex-col">
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
          <TabsContent value="results" className="mt-0 flex min-h-0 flex-1 flex-col">
            <ResultsPane
              eventId={eventId}
              aiConfigured={workspace.aiConfigured}
              timezone={timezone}
              view={view}
              refresh={refresh}
            />
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
              <div className="grid max-w-48 gap-1.5">
                <Label htmlFor="round-quorum">Reviews per submission</Label>
                <Input
                  id="round-quorum"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={draft.reviewsPerSubmission}
                  onChange={(event) =>
                    setDraft({ ...draft, reviewsPerSubmission: Number(event.target.value) })
                  }
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
                <SelectTrigger size="sm" className="w-40">
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
  tracks,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly tracks: EvaluationAdminWorkspace["tracks"];
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const reviewerTracks = useQuery(reviewerTracksQuery(eventId));
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
            tracks={tracks}
            trackIds={
              reviewerTracks.data?.ok === true
                ? (reviewerTracks.data.data.find(
                    (row) => row.eventMemberId === reviewer.member.eventMemberId,
                  )?.trackIds ?? [])
                : []
            }
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
  tracks,
  trackIds,
  refresh,
}: {
  readonly eventId: string;
  readonly roundId: string;
  readonly reviewer: ReviewRoundAdminView["reviewers"][number];
  readonly tracks: EvaluationAdminWorkspace["tracks"];
  readonly trackIds: ReadonlyArray<string>;
  readonly refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState(reviewer.member.assignmentCap?.toString() ?? "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<ReadonlySet<string>>(
    () => new Set(trackIds),
  );
  const [saving, setSaving] = useState(false);
  const openEditor = () => {
    setCap(reviewer.member.assignmentCap?.toString() ?? "");
    setSelectedTrackIds(new Set(trackIds));
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    const result = await setReviewerTracks({
      data: {
        eventId,
        roundId,
        eventMemberId: reviewer.member.eventMemberId,
        trackIds: [...selectedTrackIds],
        assignmentCap: cap.length === 0 ? null : Number(cap),
      },
    });
    setSaving(false);
    if (!result.ok) return toast.error(result.error.message);
    setOpen(false);
    await refresh();
    toast.success("Saved reviewer routing");
  };
  return (
    <div className="flex min-h-12 items-center gap-3 border-b px-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{reviewer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{reviewer.email}</p>
      </div>
      <div className="flex max-w-sm flex-wrap justify-end gap-1">
        {trackIds.length === 0 ? (
          <span className="text-xs text-muted-foreground">Generalist</span>
        ) : (
          trackIds.flatMap((trackId) => {
            const track = tracks.find((item) => item.id === trackId);
            return track === undefined
              ? []
              : [
                  <Badge
                    key={track.id}
                    variant="outline"
                    className="gap-1 px-1.5 py-0.5 text-[11px]"
                    style={{
                      borderColor: track.color,
                      color: track.color,
                      backgroundColor: `color-mix(in srgb, ${track.color} 9%, transparent)`,
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    {track.name}
                  </Badge>,
                ];
          })
        )}
      </div>
      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
        Cap {reviewer.member.assignmentCap ?? "—"}
      </span>
      <Button size="sm" variant="outline" className="pressable" onClick={openEditor}>
        <SlidersHorizontalIcon /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {reviewer.name}</DialogTitle>
            <DialogDescription>
              Track affinity guides auto-routing. No selected tracks makes this reviewer a
              generalist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`${reviewer.member.id}-cap`}>Assignment cap</Label>
              <Input
                id={`${reviewer.member.id}-cap`}
                type="number"
                min={1}
                placeholder="No cap"
                value={cap}
                onChange={(event) => setCap(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Track affinity</Label>
              <div className="grid gap-0.5 rounded-lg border p-1.5">
                {tracks.map((track) => {
                  const checked = selectedTrackIds.has(track.id);
                  return (
                    <label
                      key={track.id}
                      className={cn(
                        "pressable flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] hover:bg-muted/60",
                        checked && "bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setSelectedTrackIds((current) => {
                            const updated = new Set(current);
                            if (next === true) updated.add(track.id);
                            else updated.delete(track.id);
                            return updated;
                          })
                        }
                      />
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: track.color }}
                      />
                      {track.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save reviewer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [autoOpen, setAutoOpen] = useState(false);
  const [preview, setPreview] = useState<ReviewAssignmentBatch>();
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
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
  const assign = async () => {
    const result = await assignReviews({
      data: {
        eventId,
        roundId: view.configuration.round.id,
        eventMemberId: reviewerId,
        submissionIds: [...selected],
      },
    });
    if (!result.ok) return toast.error(result.error.message);
    setSelected(new Set());
    await refresh();
    if (result.data.created === 0) {
      toast.info("No new assignments — all selected submissions already assigned");
      return;
    }
    toast.success(
      `Assigned ${result.data.created} ${plural(result.data.created, "submission")}`,
      result.data.skipped === 0
        ? undefined
        : { description: `Skipped ${result.data.skipped} already assigned or capped.` },
    );
  };
  const openAutoDistribution = async () => {
    setAutoOpen(true);
    setPreview(undefined);
    setPreviewing(true);
    const result = await autoDistributeReviews({
      data: {
        eventId,
        roundId: view.configuration.round.id,
        trackIds: trackId === "all" ? [] : [trackId],
        dryRun: true,
      },
    });
    setPreviewing(false);
    if (!result.ok) {
      setAutoOpen(false);
      return toast.error(result.error.message);
    }
    setPreview(result.data);
  };
  const applyAutoDistribution = async () => {
    setApplying(true);
    const result = await autoDistributeReviews({
      data: {
        eventId,
        roundId: view.configuration.round.id,
        trackIds: trackId === "all" ? [] : [trackId],
        dryRun: false,
      },
    });
    setApplying(false);
    if (!result.ok) return toast.error(result.error.message);
    setAutoOpen(false);
    await refresh();
    const description = [
      `${result.data.outOfTrack} out of track`,
      `${result.data.conflictsSkipped} conflicts skipped`,
      `${result.data.shortfalls.length} shortfalls`,
    ].join(" · ");
    toast.success(`Created ${result.data.created} ${plural(result.data.created, "assignment")}`, {
      description,
    });
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
    <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Assignments</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length} of {view.submissions.length} submissions · {view.assignments.length}{" "}
            assignments
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={trackId} onValueChange={setTrackId}>
            <SelectTrigger size="sm" className="w-48">
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
            onClick={() => void openAutoDistribution()}
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
          onClick={() => void assign()}
        >
          Assign selected ({selected.size})
        </Button>
      </div>
      <TableShell
        className="mt-3"
        footer={
          <PaginationFooter
            page={pages.page}
            pageSize={pages.pageSize}
            total={filtered.length}
            onPageChange={pages.setPage}
          />
        }
      >
        <Table>
          <TableHeader>
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
      </TableShell>
      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Auto-distribute reviews</DialogTitle>
            <DialogDescription>
              Previewing {trackId === "all" ? "all tracks" : "the selected track"} at{" "}
              {view.configuration.round.reviewsPerSubmission} reviews per submission.
            </DialogDescription>
          </DialogHeader>
          {previewing ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Planning assignments…</p>
          ) : preview === undefined ? null : preview.planned.length === 0 &&
            preview.shortfalls.length === 0 ? (
            <div className="rounded-lg border px-4 py-6 text-center">
              <p className="text-[13px] font-medium">Nothing to distribute</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Every submission has {view.configuration.round.reviewsPerSubmission} reviews.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-3 divide-x rounded-lg border">
                {[
                  [preview.planned.length, "New assignments"],
                  [preview.outOfTrack, "Out of track"],
                  [preview.conflictsSkipped, "Conflicts skipped"],
                ].map(([value, label]) => (
                  <div key={label} className="px-3 py-2.5 text-center">
                    <p className="text-base font-semibold tabular-nums">{value}</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {preview.planned.length === 0 ? null : (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Reviewer load
                  </p>
                  <div className="mt-2 overflow-hidden rounded-lg border divide-y">
                    {view.reviewers.flatMap((reviewer) => {
                      const added = preview.planned.filter(
                        (assignment) => assignment.eventMemberId === reviewer.member.eventMemberId,
                      ).length;
                      if (added === 0) return [];
                      const current = view.assignments.filter(
                        (assignment) =>
                          assignment.eventMemberId === reviewer.member.eventMemberId &&
                          assignment.status !== "recused",
                      ).length;
                      return [
                        <div
                          key={reviewer.member.eventMemberId}
                          className="flex h-9 items-center justify-between px-3 text-[13px]"
                        >
                          <span className="truncate font-medium">{reviewer.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {current} → {current + added} (+{added})
                          </span>
                        </div>,
                      ];
                    })}
                  </div>
                </div>
              )}
              {preview.shortfalls.length === 0 ? null : (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Shortfalls
                  </p>
                  <div className="mt-2 overflow-hidden rounded-lg border divide-y">
                    {preview.shortfalls.map((shortfall) => (
                      <div
                        key={shortfall.submissionId}
                        className="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <span className="font-mono tabular-nums">{shortfall.code}</span>
                        <span className="text-right text-muted-foreground">
                          Missing {shortfall.missing} ·{" "}
                          {shortfall.reason === "caps_exhausted"
                            ? "caps exhausted"
                            : shortfall.reason === "no_reviewers"
                              ? "no reviewers"
                              : "conflicts"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                applying || previewing || preview === undefined || preview.planned.length === 0
              }
              onClick={() => void applyAutoDistribution()}
            >
              {applying ? "Distributing…" : `Create ${preview?.planned.length ?? 0} assignments`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    if (result.data.failed > 0) {
      toast.error(
        `Failed ${result.data.failed} of ${result.data.queued} ${plural(result.data.queued, "reminder")}`,
      );
      return;
    }
    if (result.data.queued === 0) {
      toast.info("No reminders queued — selected reviewers have no pending reviews");
      return;
    }
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

type ResultsSortKey = "aggregate" | "submitted" | "status" | "completion";

// Semantic decision order for the status sort, mirroring the desk's tabs.
const resultsStatusOrder: ReadonlyArray<string> = [
  "pending",
  "maybe",
  "accepted",
  "declined",
  "withdrawn",
  "draft",
];

function sortHeader(
  label: string,
  key: ResultsSortKey,
  sort: { readonly key: ResultsSortKey; readonly direction: "asc" | "desc" },
  toggle: (key: ResultsSortKey) => void,
) {
  return (
    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggle(key)}>
      {label}
      {sort.key === key ? (
        sort.direction === "asc" ? (
          <ArrowUpIcon className="size-3" />
        ) : (
          <ArrowDownIcon className="size-3" />
        )
      ) : (
        <ArrowUpDownIcon className="size-3 text-muted-foreground" />
      )}
    </button>
  );
}

function ResultsPane({
  eventId,
  aiConfigured,
  timezone,
  view,
  refresh,
}: {
  readonly eventId: string;
  readonly aiConfigured: boolean;
  readonly timezone: string;
  readonly view: ReviewRoundAdminView;
  readonly refresh: () => Promise<unknown>;
}) {
  const [sort, setSort] = useState<{ key: ResultsSortKey; direction: "asc" | "desc" }>({
    key: "aggregate",
    direction: "desc",
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [generating, setGenerating] = useState<string>();
  const [aiErrors, setAiErrors] = useState<Readonly<Record<string, string>>>({});
  // Spotlight tracks the id and derives the row from live results, so an AI
  // generate refresh updates the open panel instead of freezing stale data.
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const spotlightRow =
    spotlightId === null
      ? null
      : (view.results.find((row) => row.submission.id === spotlightId) ?? null);
  const statuses = Array.from(new Set(view.results.map((row) => row.submission.status))).sort(
    (a, b) => resultsStatusOrder.indexOf(a) - resultsStatusOrder.indexOf(b),
  );
  const filtered =
    statusFilter === "all"
      ? view.results
      : view.results.filter((row) => row.submission.status === statusFilter);
  const ordered = filtered
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      // Rows without an aggregate sink to the bottom in either direction.
      if (sort.key === "aggregate") {
        const a = left.row.weightedAggregate;
        const b = right.row.weightedAggregate;
        if (a === null && b === null) return left.index - right.index;
        if (a === null) return 1;
        if (b === null) return -1;
        const difference = sort.direction === "asc" ? a - b : b - a;
        return difference || left.index - right.index;
      }
      const difference =
        sort.key === "submitted"
          ? new Date(left.row.submission.submittedAt).getTime() -
            new Date(right.row.submission.submittedAt).getTime()
          : sort.key === "status"
            ? resultsStatusOrder.indexOf(left.row.submission.status) -
              resultsStatusOrder.indexOf(right.row.submission.status)
            : left.row.completedCount - right.row.completedCount ||
              left.row.reviewerCount - right.row.reviewerCount;
      const signed = sort.direction === "asc" ? difference : -difference;
      return signed || left.index - right.index;
    })
    .map(({ row }) => row);
  const toggleSort = (key: ResultsSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "status" ? "asc" : "desc" },
    );
  const pages = usePagination(ordered, {
    resetKey: `${sort.key}:${sort.direction}:${statusFilter}`,
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
    <SpotlightLayout
      spotlightId={spotlightId ?? undefined}
      orderedIds={ordered.map((row) => row.submission.id)}
      onSpotlightChange={(id) => setSpotlightId(id ?? null)}
      list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
        <div className="flex h-full min-h-0 flex-col p-4 lg:p-6">
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Round results</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {view.results.length} {plural(view.results.length, "submission")} · weighted numeric
                criteria
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => value !== null && setStatusFilter(value)}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status[0]?.toUpperCase()}
                      {status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="pressable"
                onClick={() => void download()}
              >
                <DownloadIcon /> Export CSV
              </Button>
            </div>
          </div>
          <TableShell
            className="mt-3"
            scrollRef={scrollRef}
            footer={
              <PaginationFooter
                page={pages.page}
                pageSize={pages.pageSize}
                total={ordered.length}
                onPageChange={pages.setPage}
              />
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="h-8 hover:bg-transparent">
                  {compact ? (
                    <TableHead className="h-8 w-28 text-xs">
                      {sortHeader("Status", "status", sort, toggleSort)}
                    </TableHead>
                  ) : null}
                  <TableHead className="h-8 text-xs">Submission</TableHead>
                  {compact ? null : (
                    <>
                      <TableHead className="h-8 min-w-40 text-xs">Speakers</TableHead>
                      <TableHead className="h-8 min-w-24 text-xs">
                        {sortHeader("Status", "status", sort, toggleSort)}
                      </TableHead>
                      <TableHead className="h-8 min-w-28 text-xs">Recommendation</TableHead>
                      <TableHead className="h-8 min-w-24 text-xs">
                        {sortHeader("Completion", "completion", sort, toggleSort)}
                      </TableHead>
                      <TableHead className="h-8 min-w-28 text-xs">
                        {sortHeader("Submitted", "submitted", sort, toggleSort)}
                      </TableHead>
                    </>
                  )}
                  <TableHead className="h-8 min-w-24 text-xs">
                    {sortHeader("Aggregate", "aggregate", sort, toggleSort)}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.pageItems.map((row) => (
                  <TableRow
                    key={row.submission.id}
                    ref={rowRef(row.submission.id)}
                    className={cn("h-12 cursor-pointer", rowClassName(row.submission.id))}
                    onClick={() => openSpotlight(row.submission.id)}
                  >
                    {compact ? (
                      <TableCell className="w-28">
                        <StatusBadge status={row.submission.status} />
                      </TableCell>
                    ) : null}
                    <TableCell className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[13px] font-medium",
                          compact ? "max-w-72" : "max-w-96",
                        )}
                        title={row.submission.title}
                      >
                        <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
                          {row.submission.code}
                        </span>
                        {row.submission.title}
                      </p>
                    </TableCell>
                    {compact ? null : (
                      <>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {row.submission.participants.map((participant) => (
                              <SpeakerBadge
                                key={`${participant.contactId ?? participant.name}:${participant.role}`}
                                person={{
                                  id: participant.contactId ?? undefined,
                                  name: participant.name,
                                  image: participant.headshotUrl,
                                }}
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.submission.status} />
                        </TableCell>
                        <TableCell className="text-xs">{row.recommendation ?? "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {row.completedCount}/{row.reviewerCount}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          <Timestamp
                            value={row.submission.submittedAt}
                            timezone={timezone}
                            mode="date"
                          />
                        </TableCell>
                      </>
                    )}
                    <TableCell className="font-medium tabular-nums">
                      {row.weightedAggregate?.toFixed(2) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </div>
      )}
      panel={
        spotlightRow === null ? null : (
          <ResultSpotlightPanel
            eventId={eventId}
            aiConfigured={aiConfigured}
            row={spotlightRow}
            view={view}
            generating={generating === spotlightRow.submission.id}
            aiError={aiErrors[spotlightRow.submission.id]}
            generate={() => void generate(spotlightRow.submission.id)}
            refresh={refresh}
            onClose={() => setSpotlightId(null)}
          />
        )
      }
    />
  );
}

// The results spotlight panel — same surface as the submissions desk: the
// table stays scannable and everything about one submission lives here
// (scorecard, every review with its full comments, AI first-pass).
function ResultSpotlightPanel({
  eventId,
  aiConfigured,
  row,
  view,
  generating,
  aiError,
  generate,
  refresh,
  onClose,
}: {
  readonly eventId: string;
  readonly aiConfigured: boolean;
  readonly row: EvaluationResultRow;
  readonly view: ReviewRoundAdminView;
  readonly generating: boolean;
  readonly aiError: string | undefined;
  readonly generate: () => void;
  readonly refresh: () => Promise<unknown>;
  readonly onClose: () => void;
}) {
  return (
    <>
      <SpotlightPanelHeader
        identity={
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {row.submission.code}
          </span>
        }
        status={<StatusBadge status={row.submission.status} />}
        actions={
          <Button size="icon-sm" variant="ghost" className="pressable" asChild>
            <Link
              to="/admin/submissions/$id"
              params={{ id: row.submission.id }}
              search={{ status: "all" }}
              aria-label="Open full submission page"
            >
              <ExternalLinkIcon />
            </Link>
          </Button>
        }
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-16">
        <h2 className="font-semibold">{row.submission.title}</h2>
        {row.submission.participants.length === 0 ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {row.submission.participants.map((participant) => (
              <span
                key={`${participant.contactId ?? participant.name}:${participant.role}`}
                className="flex items-center gap-1.5"
              >
                <SpeakerBadge
                  person={{
                    id: participant.contactId ?? undefined,
                    name: participant.name,
                    image: participant.headshotUrl,
                  }}
                />
                <span className="text-xs text-muted-foreground">{participant.role}</span>
              </span>
            ))}
          </div>
        )}
        <section className="mt-4 rounded-lg border">
          <div className="flex items-baseline justify-between gap-2 px-3 pt-3">
            <p className="text-xs font-semibold">Scorecard</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {row.completedCount}/{row.reviewerCount} {plural(row.reviewerCount, "review")}{" "}
              complete
            </p>
          </div>
          <dl className="mt-2.5 grid gap-2 px-3 pb-3">
            {view.configuration.criteria
              .filter((criterion) => criterion.type !== "text")
              .map((criterion) => (
                <div key={criterion.id} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">{criterion.label}</dt>
                  <dd className="text-xs">
                    <CriterionSummary criterion={criterion} reviews={row.humanReviews} />
                  </dd>
                </div>
              ))}
          </dl>
          <div className="flex items-baseline justify-between gap-3 border-t px-3 py-2.5">
            <p className="text-xs font-medium">Weighted aggregate</p>
            <p className="text-xs font-semibold tabular-nums">
              {row.weightedAggregate?.toFixed(2) ?? "—"}
            </p>
          </div>
        </section>
        <section className="mt-4 rounded-lg border">
          <p className="px-3 pt-3 text-xs font-semibold">
            Human reviews · {row.humanReviews.length}
          </p>
          {row.humanReviews.length === 0 ? (
            <p className="px-3 pt-2 pb-3 text-xs text-muted-foreground">
              No human reviews assigned.
            </p>
          ) : (
            <div className="mt-3 divide-y border-t">
              {byRecency(row.humanReviews).map((review) => (
                <div key={review.assignment.id} className="px-3 py-3">
                  <ReviewEntry review={review} />
                </div>
              ))}
            </div>
          )}
        </section>
        {row.aiResult === null ? (
          <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg border border-dashed px-3 py-2">
            <BotIcon className="size-4 shrink-0 text-muted-foreground" />
            <p className="shrink-0 text-xs font-medium">AI first-pass</p>
            {aiError === undefined ? (
              <p className="truncate text-xs text-muted-foreground">
                {aiConfigured ? "Not generated yet" : "Anthropic key not configured"}
              </p>
            ) : (
              <p
                className="truncate text-xs font-medium text-destructive"
                role="alert"
                title={aiError}
              >
                {aiError}
              </p>
            )}
            {aiConfigured ? (
              <Button
                size="sm"
                variant="outline"
                className="pressable ml-auto shrink-0"
                disabled={generating}
                onClick={generate}
              >
                <SparklesIcon /> {generating ? "Generating…" : "Run AI review"}
              </Button>
            ) : null}
          </div>
        ) : (
          <section className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4 text-primary" />
              <p className="text-xs font-semibold">AI first-pass</p>
              <Badge className="bg-primary text-primary-foreground">AI</Badge>
            </div>
            <AiResult eventId={eventId} row={row} refresh={refresh} />
          </section>
        )}
      </div>
    </>
  );
}

type HumanReview = EvaluationResultRow["humanReviews"][number];
type ResultCriterion = ReviewRoundAdminView["configuration"]["criteria"][number];

// Most recently completed first; assignments still open sink to the bottom.
const byRecency = (reviews: ReadonlyArray<HumanReview>): ReadonlyArray<HumanReview> =>
  [...reviews].sort((a, b) => completedTime(b) - completedTime(a));
const completedTime = (review: HumanReview) =>
  review.assignment.completedAt === null ? -1 : new Date(review.assignment.completedAt).getTime();

// Same status palette the reviewer workspace uses for these assignments.
const assignmentBadgeClass: Readonly<Record<"pending" | "completed" | "recused", string>> = {
  completed: "bg-status-accepted text-status-accepted-foreground",
  recused: "bg-status-declined text-status-declined-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
};

// Dropdown options are free-form, so decision colors are matched by intent;
// unrecognized options stay in the plain foreground color.
const decisionTextClass = (value: string) => {
  const lower = value.toLowerCase();
  if (lower.includes("accept")) return statusTextClass.accepted;
  if (lower.includes("maybe")) return statusTextClass.maybe;
  if (lower.includes("reject") || lower.includes("declin")) return statusTextClass.declined;
  return "text-foreground";
};

const formatMean = (values: ReadonlyArray<number>) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number.isInteger(mean) ? mean.toString() : mean.toFixed(1);
};

// One glanceable value per cell: numeric criteria aggregate to a mean,
// dropdowns collapse when unanimous, and free text never dumps into the
// table — a single answer truncates, several become a count.
function CriterionSummary({
  criterion,
  reviews,
}: {
  readonly criterion: ResultCriterion;
  readonly reviews: ReadonlyArray<HumanReview>;
}) {
  const answers = reviews.flatMap((review) =>
    review.answers.filter((answer) => answer.criterionId === criterion.id),
  );
  if (criterion.type === "numeric") {
    const values = answers.flatMap((answer) =>
      answer.numericValue === null ? [] : [answer.numericValue],
    );
    if (values.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="tabular-nums">
        {formatMean(values)}
        {values.length > 1 ? (
          <span className="text-muted-foreground"> · {values.length}</span>
        ) : null}
      </span>
    );
  }
  const values = answers.flatMap((answer) => {
    const value = answer.optionValue ?? answer.textValue;
    return value === null || value.trim().length === 0 ? [] : [value];
  });
  if (values.length === 0) return <span className="text-muted-foreground">—</span>;
  if (criterion.type === "dropdown") {
    // Tally in the criterion's own option order: "2 Accept · 1 Maybe".
    const counts = new Map<string, number>(values.map((value) => [value, 0]));
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const ordered = [
      ...criterion.options.filter((option) => counts.has(option)),
      ...[...counts.keys()].filter((value) => !criterion.options.includes(value)),
    ];
    return (
      <span className="flex flex-wrap gap-x-2">
        {ordered.map((option) => (
          <span key={option} className="whitespace-nowrap">
            {values.length > 1 ? (
              <span className="text-muted-foreground tabular-nums">{counts.get(option)} </span>
            ) : null}
            <span className={cn("font-medium", decisionTextClass(option))}>{option}</span>
          </span>
        ))}
      </span>
    );
  }
  if (values.length === 1) {
    return (
      <span className="block max-w-48 truncate" title={values[0]}>
        {values[0]}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {values.length} {plural(values.length, "answer")}
    </span>
  );
}

function ReviewEntry({ review }: { readonly review: HumanReview }) {
  const scored = review.answers.filter(
    (answer) => answer.numericValue !== null || answer.optionValue !== null,
  );
  const comments = review.answers.filter(
    (answer) =>
      answer.numericValue === null &&
      answer.optionValue === null &&
      answer.textValue !== null &&
      answer.textValue.trim().length > 0,
  );
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs font-medium">{review.reviewerName}</span>
        <Badge className={cn("text-[10px]", assignmentBadgeClass[review.assignment.status])}>
          {review.assignment.status}
        </Badge>
      </div>
      {review.assignment.recusalReason === null ? null : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Recusal: {review.assignment.recusalReason}
        </p>
      )}
      {scored.length === 0 ? null : (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {scored.map((answer) => (
            <span key={answer.criterionId}>
              {answer.label}{" "}
              {answer.numericValue === null && answer.optionValue !== null ? (
                <span className={cn("font-medium", decisionTextClass(answer.optionValue))}>
                  {answer.optionValue}
                </span>
              ) : (
                <span className="font-medium text-foreground tabular-nums">
                  {answer.numericValue}
                </span>
              )}
            </span>
          ))}
        </p>
      )}
      {comments.map((answer) => (
        <p
          key={answer.criterionId}
          className="mt-2 text-xs leading-5 break-words text-muted-foreground"
        >
          <span className="font-medium text-foreground">{answer.label}: </span>
          {answer.textValue}
        </p>
      ))}
    </div>
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
