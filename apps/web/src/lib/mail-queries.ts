import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAdminEmails, getCalendarInviteSummary } from "@/server-fns/mail";

export const adminEmailsQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.emails(eventId),
    queryFn: () => getAdminEmails({ data: { eventId } }),
    staleTime: 10_000,
  });

export const calendarInviteSummaryQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.calendarInvites(eventId),
    queryFn: () => getCalendarInviteSummary({ data: { eventId } }),
    staleTime: 10_000,
  });
