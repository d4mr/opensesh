import { queryOptions } from "@tanstack/react-query";

import { getAgenda, getPublicAgenda } from "@/server-fns/agenda";

export const agendaQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["agenda", eventId],
    queryFn: () => getAgenda({ data: { eventId } }),
    staleTime: 30_000,
  });

export const publicAgendaQuery = (eventSlug: string) =>
  queryOptions({
    queryKey: ["public-agenda", eventSlug],
    queryFn: () => getPublicAgenda({ data: { eventSlug } }),
    staleTime: 30_000,
  });
