import { queryOptions } from "@tanstack/react-query";

import { getAdminBootstrap } from "@/server-fns/admin";
import { getReviewDeskDetail, getReviewDeskList } from "@/server-fns/review-desk";

export const adminEventsQuery = queryOptions({
  queryKey: ["admin-events"],
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

export const reviewDeskListQuery = (eventId: string, kind: "abstract" | "session") =>
  queryOptions({
    queryKey: ["review-desk", eventId, kind],
    queryFn: () => getReviewDeskList({ data: { eventId, kind } }),
    staleTime: 30_000,
  });

export const reviewDeskDetailQuery = (eventId: string, submissionId: string) =>
  queryOptions({
    queryKey: ["review-desk-detail", eventId, submissionId],
    queryFn: () => getReviewDeskDetail({ data: { eventId, submissionId } }),
    staleTime: 30_000,
  });
