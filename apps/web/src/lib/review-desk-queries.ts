import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAdminBootstrap } from "@/server-fns/admin";
import { getReviewDeskDetail, getReviewDeskList } from "@/server-fns/review-desk";
import { getSessionList, getSubmissionTimeline } from "@/server-fns/sessions";

export const adminEventsQuery = queryOptions({
  queryKey: qk.org.events,
  queryFn: () => getAdminBootstrap(),
  staleTime: 30_000,
});

export const reviewDeskListQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.reviewDesk(eventId),
    queryFn: () => getReviewDeskList({ data: { eventId } }),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const result = query.state.data;
      return result?.ok && result.data.mailStatus.queued + result.data.mailStatus.sending > 0
        ? 1_000
        : false;
    },
  });

export const sessionListQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.sessions(eventId),
    queryFn: () => getSessionList({ data: { eventId } }),
    staleTime: 30_000,
  });

export const submissionTimelineQuery = (eventId: string, submissionId: string) =>
  queryOptions({
    queryKey: qk.submissionTimeline(eventId, submissionId),
    queryFn: () => getSubmissionTimeline({ data: { eventId, submissionId } }),
    staleTime: 30_000,
  });

export const reviewDeskDetailQuery = (eventId: string, submissionId: string) =>
  queryOptions({
    queryKey: qk.reviewDeskDetail(eventId, submissionId),
    queryFn: () => getReviewDeskDetail({ data: { eventId, submissionId } }),
    staleTime: 30_000,
  });
