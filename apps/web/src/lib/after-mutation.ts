import type { QueryClient } from "@tanstack/react-query";

/**
 * The app's write-path cache policy: after ANY successful mutation, every
 * cached read that could have been affected is marked stale in one shot.
 * Queries with observers on screen refetch immediately (awaiting the returned
 * promise covers them, and the SyncIndicator in the shell headers shows while
 * they do); everything else refetches on its next mount.
 *
 * Scoping rides the canonical key tree (query-keys.ts): a write in one event
 * cannot change another event's data, so when the caller passes its eventId
 * the other events' `["event", …]` subtrees are skipped. Content-addressed
 * `["immutable", …]` entries are never invalidated. Everything else — viewer,
 * org, this event, public — refreshes, because writes genuinely ripple across
 * those surfaces (a decision touches the dashboard, the evaluation results,
 * the agenda backlog, the email log, the org CRM, the public program).
 *
 * There is deliberately NO per-mutation list of query keys: hand-maintained
 * lists developed gaps twice (V2-008, V3-008). Surfaces still layer
 * optimistic cache writes (setQueryData + rollback) on top for instant
 * feedback — this is the floor underneath them.
 */
export const invalidateAfterMutation = (queryClient: QueryClient, eventId?: string) =>
  queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] !== "immutable" &&
      !(eventId !== undefined && queryKey[0] === "event" && queryKey[1] !== eventId),
  });
