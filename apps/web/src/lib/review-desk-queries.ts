import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAdminBootstrap } from "@/server-fns/admin";
import { getReviewDeskDetail, getReviewDeskList } from "@/server-fns/review-desk";

export const adminEventsQuery = queryOptions({
  queryKey: qk.org.events,
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

export const reviewDeskListQuery = (eventId: string, kind: "abstract" | "session") =>
  queryOptions({
    queryKey: qk.reviewDesk(eventId, kind),
    queryFn: () => getReviewDeskList({ data: { eventId, kind } }),
    staleTime: 30_000,
  });

export const reviewDeskDetailQuery = (eventId: string, submissionId: string) =>
  queryOptions({
    queryKey: qk.reviewDeskDetail(eventId, submissionId),
    queryFn: () => getReviewDeskDetail({ data: { eventId, submissionId } }),
    staleTime: 30_000,
  });
