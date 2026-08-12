import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// SSR renders while route queries are still in flight, but the client
// hydrates a settled cache — reading fetch counts during hydration is a
// guaranteed mismatch. Both the server render and React's hydration pass use
// the server snapshot (idle), and the live value applies right after.
const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * Quiet cross-app sync affordance, one per shell header. Fades in only when a
 * refetch or mutation stays in flight past a beat (the show transition is
 * delayed, the hide is immediate), so instant round-trips never flash.
 */
export function SyncIndicator({ className }: { readonly className?: string }) {
  const hydrated = useHydrated();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = hydrated && fetching + mutating > 0;
  return (
    <LoaderCircleIcon
      aria-hidden="true"
      className={cn(
        "size-3 shrink-0 text-muted-foreground/80 transition-opacity duration-200",
        busy ? "animate-spin opacity-100 delay-300" : "opacity-0 delay-0",
        className,
      )}
    />
  );
}
