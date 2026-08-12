import { queryOptions } from "@tanstack/react-query";

import { getAgenda, listAgendaDrafts } from "@/server-fns/agenda";

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
