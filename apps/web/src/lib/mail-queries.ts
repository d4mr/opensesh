import { queryOptions } from "@tanstack/react-query";

import { getAdminEmails, getCalendarInviteSummary } from "@/server-fns/mail";

export const adminEmailsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["admin-emails", eventId],
    queryFn: () => getAdminEmails({ data: { eventId } }),
    staleTime: 10_000,
  });

export const calendarInviteSummaryQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["calendar-invite-summary", eventId],
    queryFn: () => getCalendarInviteSummary({ data: { eventId } }),
    staleTime: 10_000,
  });
