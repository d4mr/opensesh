import { queryOptions } from "@tanstack/react-query";

import { getPortalAdmin, getSpeakerPortal } from "@/server-fns/portal";

export const speakerPortalQuery = queryOptions({
  queryKey: ["speaker-portal"],
  queryFn: () => getSpeakerPortal(),
  staleTime: 10_000,
});

export const adminPortalQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["admin-portal", eventId],
    queryFn: () => getPortalAdmin({ data: { eventId } }),
    staleTime: 10_000,
  });
