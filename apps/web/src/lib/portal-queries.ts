import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getPortalAdmin, getSpeakerPortal } from "@/server-fns/portal";

export const speakerPortalQuery = queryOptions({
  queryKey: qk.viewer.speakerPortal,
  queryFn: () => getSpeakerPortal(),
  staleTime: 10_000,
});

export const adminPortalQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.portalAdmin(eventId),
    queryFn: () => getPortalAdmin({ data: { eventId } }),
    staleTime: 10_000,
  });
