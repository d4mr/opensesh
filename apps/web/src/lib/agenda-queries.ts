import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAgenda, listAgendaDrafts } from "@/server-fns/agenda";

export const agendaQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.agenda(eventId),
    queryFn: () => getAgenda({ data: { eventId } }),
    staleTime: 30_000,
  });

export const agendaDraftsQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.agendaDrafts(eventId),
    queryFn: () => listAgendaDrafts({ data: { eventId } }),
    staleTime: 15_000,
  });
