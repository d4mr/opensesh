import { CircleCheckIcon, CircleXIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui";

type Decision = "pending" | "accepted" | "declined";

const badge: Record<Decision, { readonly label: string; readonly className: string }> = {
  pending: { label: "pending", className: "bg-status-pending-bg text-status-pending" },
  accepted: { label: "accepted", className: "bg-status-accepted-bg text-status-accepted" },
  declined: { label: "declined", className: "bg-status-declined-bg text-status-declined" },
};

/** Live miniature of the reviewer queue: score, decide, watch the side effects. */
export function ReviewDemo() {
  const [score, setScore] = useState(4);
  const [decision, setDecision] = useState<Decision>("pending");
  const DecisionIcon =
    decision === "accepted" ? CircleCheckIcon : decision === "declined" ? CircleXIcon : LoaderIcon;

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-10 items-center justify-between border-b bg-paper px-4">
        <p className="font-mono text-xs text-muted-foreground tabular-nums">SESS-27</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize",
            badge[decision].className,
          )}
        >
          <DecisionIcon className="size-3" aria-hidden="true" />
          {badge[decision].label}
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm font-medium">Opening keynote: the new AI engineering stack</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Maya Chen · Retrieval Labs · Agents track
        </p>
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          A tour of what changed since last year: smaller models doing more, evals moving into CI,
          and the quiet death of the prompt spreadsheet.
        </p>
        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">Your score</p>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Score ${value} of 5`}
                  onClick={() => setScore(value)}
                  className={cn(
                    "pressable size-6 rounded-full border text-center text-[11px] leading-6 font-medium tabular-nums transition-colors",
                    value <= score
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Team average <span className="font-medium text-foreground tabular-nums">4.2</span>
            <br />3 reviews in
          </p>
        </div>
      </div>
      <div className="flex h-12 items-center justify-between border-t bg-paper px-4">
        {decision === "pending" ? (
          <>
            <button
              type="button"
              onClick={() => setDecision("declined")}
              className="pressable rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setDecision("accepted")}
              className="pressable rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Accept
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {decision === "accepted"
                ? "Speaker portal created · 3 onboarding tasks assigned"
                : "Polite decline queued for the next email batch"}
            </p>
            <button
              type="button"
              onClick={() => setDecision("pending")}
              className="pressable text-xs text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}
