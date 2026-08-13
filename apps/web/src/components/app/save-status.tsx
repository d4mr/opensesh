import { CheckIcon, LoaderCircleIcon } from "lucide-react";

import type { AutosaveState } from "@/hooks/use-autosave";

// Quiet sync indicator, Linear-style: a small fixed-width annotation that
// never competes with the toolbar buttons. Failure is the only loud state.
export function SaveStatus({
  state,
  retry,
}: {
  readonly state: AutosaveState;
  readonly retry: () => void;
}) {
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={retry}
        className="flex items-center gap-1 text-xs font-medium text-destructive"
        role="status"
        aria-live="polite"
      >
        Save failed — retry
      </button>
    );
  }
  return (
    <span
      className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? (
        <LoaderCircleIcon className="size-3 animate-spin" />
      ) : state === "saved" ? (
        <CheckIcon className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
      )}
      {state === "saving" ? "Saving" : state === "saved" ? "Saved" : "Unsaved"}
    </span>
  );
}
