import type { ReviewAnswerInput, ReviewCriterion, ReviewerWorkspace } from "@opensesh/domain";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, CircleSlash2Icon, Clock3Icon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/components/forms/datetime-picker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reviewerEvaluationQuery } from "@/lib/evaluation-queries";
import { cn } from "@/lib/utils";
import { recuseReview, submitReviewAnswers } from "@/server-fns/reviews";

interface DraftAnswer {
  readonly numeric: string;
  readonly text: string;
  readonly option: string;
}

const emptyAnswer = (): DraftAnswer => ({ numeric: "", text: "", option: "" });

function ScorePicker({
  id,
  criterion,
  value,
  onChange,
}: {
  readonly id: string;
  readonly criterion: ReviewCriterion;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const min = criterion.min ?? 1;
  const max = criterion.max ?? 5;
  const span = max - min + 1;
  if (!Number.isInteger(min) || !Number.isInteger(max) || span < 2 || span > 10)
    return (
      <Input
        id={id}
        type="number"
        min={criterion.min ?? undefined}
        max={criterion.max ?? undefined}
        step="any"
        required={criterion.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-40"
      />
    );
  const scores = Array.from({ length: span }, (_, index) => min + index);
  return (
    <div id={id} role="radiogroup" aria-label={criterion.label} className="flex gap-1">
      {scores.map((score) => {
        const selectedScore = String(score) === value;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={selectedScore}
            onClick={() => onChange(selectedScore ? "" : String(score))}
            className={cn(
              "pressable flex size-9 items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors",
              selectedScore
                ? "border-primary bg-primary/10 text-primary"
                : "bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
            )}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}

const answerDraft = (
  criteria: ReadonlyArray<ReviewCriterion>,
  answers: ReviewerWorkspace["rounds"][number]["items"][number]["answers"],
) =>
  Object.fromEntries(
    criteria.map((criterion) => {
      const answer = answers.find((item) => item.criterionId === criterion.id);
      return [
        criterion.id,
        {
          numeric: answer?.numericValue?.toString() ?? "",
          text: answer?.textValue ?? "",
          option: answer?.optionValue ?? "",
        },
      ];
    }),
  );

const statusClass = (status: "pending" | "completed" | "recused") =>
  status === "completed"
    ? "bg-status-accepted text-status-accepted-foreground"
    : status === "recused"
      ? "bg-status-declined text-status-declined-foreground"
      : "bg-status-pending text-status-pending-foreground";

export function ReviewerEvaluationWorkspace({
  data,
  timezone,
}: {
  readonly data: ReviewerWorkspace;
  readonly timezone: string;
}) {
  const queryClient = useQueryClient();
  const allItems = data.rounds.flatMap((round) => round.items.map((item) => ({ round, item })));
  const [selectedId, setSelectedId] = useState(allItems[0]?.item.assignment.id ?? "");
  const selected = allItems.find(({ item }) => item.assignment.id === selectedId) ?? allItems[0];
  const [draftsByAssignment, setDraftsByAssignment] = useState<
    Readonly<Record<string, Readonly<Record<string, DraftAnswer>>>>
  >(() =>
    Object.fromEntries(
      allItems.map(({ round, item }) => [
        item.assignment.id,
        answerDraft(round.criteria, item.answers),
      ]),
    ),
  );
  const drafts =
    selected === undefined ? {} : (draftsByAssignment[selected.item.assignment.id] ?? {});
  const [saving, setSaving] = useState(false);
  const [recuseOpen, setRecuseOpen] = useState(false);
  const [recusalReason, setRecusalReason] = useState("");

  const update = (criterionId: string, values: Partial<DraftAnswer>) =>
    setDraftsByAssignment((current) => {
      if (selected === undefined) return current;
      const assignmentId = selected.item.assignment.id;
      const assignment = current[assignmentId] ?? {};
      return {
        ...current,
        [assignmentId]: {
          ...assignment,
          [criterionId]: { ...(assignment[criterionId] ?? emptyAnswer()), ...values },
        },
      };
    });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: reviewerEvaluationQuery(data.eventId).queryKey });

  const submit = async () => {
    if (selected === undefined || saving) return;
    setSaving(true);
    const answers: ReadonlyArray<ReviewAnswerInput> = selected.round.criteria.map((criterion) => {
      const draft = drafts[criterion.id] ?? emptyAnswer();
      return {
        criterionId: criterion.id,
        numericValue:
          criterion.type === "numeric" && draft.numeric.length > 0 ? Number(draft.numeric) : null,
        textValue:
          criterion.type === "text" && draft.text.trim().length > 0 ? draft.text.trim() : null,
        optionValue: criterion.type === "dropdown" && draft.option.length > 0 ? draft.option : null,
      };
    });
    const result = await submitReviewAnswers({
      data: { eventId: data.eventId, assignmentId: selected.item.assignment.id, answers },
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ["review-desk", data.eventId] }),
      queryClient.invalidateQueries({ queryKey: ["review-desk-detail", data.eventId] }),
    ]);
    toast.success(`Completed review for ${selected.item.code}`);
  };

  const recuse = async () => {
    if (selected === undefined) return;
    const result = await recuseReview({
      data: {
        eventId: data.eventId,
        assignmentId: selected.item.assignment.id,
        reason: recusalReason,
      },
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setRecuseOpen(false);
    setRecusalReason("");
    await refresh();
    toast.success(`Recused from ${selected.item.code}`);
  };

  if (allItems.length === 0) {
    return (
      <main className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <CheckCircle2Icon className="mx-auto size-9 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight">No reviews assigned</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New assignments will appear here by review round.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col text-sm">
      <header className="border-b px-4 py-3 lg:px-6">
        <h1 className="text-lg font-semibold tracking-tight">My Reviews</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {allItems.length} assigned {allItems.length === 1 ? "proposal" : "proposals"} across{" "}
          {data.rounds.length} {data.rounds.length === 1 ? "round" : "rounds"}
        </p>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-r bg-muted/20 p-2">
          {data.rounds.map((round) => (
            <section key={round.round.id} className="mb-4">
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold">{round.round.name}</h2>
                  {round.round.blind ? (
                    <Badge variant="outline" className="ml-auto gap-1 text-[10px]">
                      <EyeOffIcon className="size-3" /> Blind
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Due {formatDateTime(round.round.closesAt.toISOString(), timezone)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {round.pending} pending · {round.completed} completed · {round.recused} recused
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                {round.items.map((item) => (
                  <button
                    key={item.assignment.id}
                    type="button"
                    className={`pressable flex w-full items-center gap-2 border-b px-2.5 py-2 text-left last:border-b-0 hover:bg-muted/50 ${selected?.item.assignment.id === item.assignment.id ? "bg-muted" : ""}`}
                    onClick={() => setSelectedId(item.assignment.id)}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {item.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {item.title}
                    </span>
                    <Badge className={`${statusClass(item.assignment.status)} text-[10px]`}>
                      {item.assignment.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        {selected === undefined ? null : (
          <section className="overflow-y-auto">
            <div className="mx-auto max-w-3xl p-4 lg:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {selected.item.code}
                </span>
                <Badge className={statusClass(selected.item.assignment.status)}>
                  {selected.item.assignment.status}
                </Badge>
                {selected.round.round.blind ? (
                  <Badge variant="outline" className="gap-1">
                    <EyeOffIcon className="size-3" /> Blind review
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{selected.item.title}</h2>
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.item.trackNames.map((track) => (
                  <Badge key={track} variant="outline">
                    {track}
                  </Badge>
                ))}
              </div>
              {selected.item.participants.length === 0 ? null : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {selected.item.participants
                    .map((participant) => `${participant.name} · ${participant.role}`)
                    .join("; ")}
                </p>
              )}
              <p className="mt-4 leading-6 text-muted-foreground">{selected.item.description}</p>

              {selected.item.assignment.status === "recused" ? (
                <div className="mt-6 border-t pt-5">
                  <p className="font-medium">You recused from this assignment.</p>
                  {selected.item.assignment.recusalReason === null ? null : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.item.assignment.recusalReason}
                    </p>
                  )}
                </div>
              ) : (
                <form
                  className="mt-6 space-y-5 border-t pt-5 pb-14"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <div>
                    <h3 className="font-semibold">{selected.round.round.name} scorecard</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Required criteria are marked with an asterisk.
                    </p>
                  </div>
                  {selected.round.criteria.map((criterion) => {
                    const draft = drafts[criterion.id] ?? emptyAnswer();
                    return (
                      <div key={criterion.id} className="grid gap-1.5">
                        <Label htmlFor={`review-${criterion.id}`}>
                          {criterion.label}
                          {criterion.required ? " *" : ""}
                          {criterion.type === "numeric" ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              {criterion.min}–{criterion.max} · weight {criterion.weight}
                            </span>
                          ) : null}
                        </Label>
                        {criterion.type === "numeric" ? (
                          <ScorePicker
                            id={`review-${criterion.id}`}
                            criterion={criterion}
                            value={draft.numeric}
                            onChange={(numeric) => update(criterion.id, { numeric })}
                          />
                        ) : criterion.type === "dropdown" ? (
                          <Select
                            value={draft.option}
                            onValueChange={(option) => update(criterion.id, { option })}
                          >
                            <SelectTrigger id={`review-${criterion.id}`} className="max-w-xs">
                              <SelectValue placeholder="Choose an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {criterion.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Textarea
                            id={`review-${criterion.id}`}
                            required={criterion.required}
                            value={draft.text}
                            onChange={(event) => update(criterion.id, { text: event.target.value })}
                            className="min-h-24 resize-y"
                          />
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="pressable"
                      onClick={() => setRecuseOpen(true)}
                    >
                      <CircleSlash2Icon /> Recuse
                    </Button>
                    <Button type="submit" className="pressable" disabled={saving}>
                      <CheckCircle2Icon /> {saving ? "Submitting…" : "Submit review"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={recuseOpen} onOpenChange={setRecuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuse from this review?</DialogTitle>
            <DialogDescription>
              The organizer will see the recused status and your optional reason. This cannot be
              undone from the reviewer workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="recusal-reason">Reason (optional)</Label>
            <Textarea
              id="recusal-reason"
              value={recusalReason}
              onChange={(event) => setRecusalReason(event.target.value)}
              placeholder="Conflict of interest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecuseOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void recuse()}>
              <Clock3Icon /> Confirm recusal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
