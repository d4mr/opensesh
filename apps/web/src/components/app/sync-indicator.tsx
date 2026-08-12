import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Quiet cross-app sync affordance, one per shell header. Fades in only when a
 * refetch or mutation stays in flight past a beat (the show transition is
 * delayed, the hide is immediate), so instant round-trips never flash.
 */
export function SyncIndicator({ className }: { readonly className?: string }) {
  const busy = useIsFetching() + useIsMutating() > 0;
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
