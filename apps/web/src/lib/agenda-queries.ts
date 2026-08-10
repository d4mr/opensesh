import { queryOptions } from "@tanstack/react-query";

import { getAgenda, getPublicAgenda, listAgendaDrafts } from "@/server-fns/agenda";

export const agendaQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["agenda", eventId],
    queryFn: () => getAgenda({ data: { eventId } }),
    staleTime: 30_000,
  });

export const agendaDraftsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["agenda-drafts", eventId],
    queryFn: () => listAgendaDrafts({ data: { eventId } }),
    staleTime: 15_000,
  });

export const publicAgendaQuery = (eventSlug: string) =>
  queryOptions({
    queryKey: ["public-agenda", eventSlug],
    queryFn: () => getPublicAgenda({ data: { eventSlug } }),
    staleTime: 30_000,
  });
