import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAdminEvaluation, getReviewerEvaluation } from "@/server-fns/reviews";

export const adminEvaluationQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.evaluationAdmin(eventId),
    queryFn: () => getAdminEvaluation({ data: { eventId } }),
    staleTime: 10_000,
  });

export const reviewerEvaluationQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.evaluationReviewer(eventId),
    queryFn: () => getReviewerEvaluation({ data: { eventId } }),
    staleTime: 10_000,
  });
