import { queryOptions } from "@tanstack/react-query";

import { getAdminEvaluation, getReviewerEvaluation } from "@/server-fns/reviews";

export const adminEvaluationQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["evaluation", "admin", eventId],
    queryFn: () => getAdminEvaluation({ data: { eventId } }),
    staleTime: 10_000,
  });

export const reviewerEvaluationQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["evaluation", "reviewer", eventId],
    queryFn: () => getReviewerEvaluation({ data: { eventId } }),
    staleTime: 10_000,
  });
