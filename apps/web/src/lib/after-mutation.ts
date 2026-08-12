import type { QueryClient } from "@tanstack/react-query";

/**
 * The app's write-path cache policy: after ANY successful mutation the entire
 * query cache is marked stale in one shot. Queries with observers on screen
 * refetch immediately (awaiting the returned promise covers them, and the
 * SyncIndicator in the shell headers shows while they do); everything else
 * refetches on its next mount.
 *
 * Per-mutation key bookkeeping is deliberately NOT used here: writes ripple
 * across surfaces (a decision touches the dashboard, evaluation results, the
 * agenda backlog, the email log, …) and hand-maintained key lists kept
 * developing gaps. Over-invalidation is bounded by what is actually on
 * screen, so correctness costs at most a couple of cheap refetches.
 *
 * Surfaces still layer optimistic cache writes (setQueryData + rollback) on
 * top for instant feedback — this is the floor underneath them.
 */
export const invalidateAfterMutation = (queryClient: QueryClient) =>
  queryClient.invalidateQueries();
