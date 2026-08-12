import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getAdminResources, getPortalResources } from "@/server-fns/resources";

export const adminResourcesQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.resources(eventId),
    queryFn: () => getAdminResources({ data: { eventId } }),
    staleTime: 10_000,
  });

export const portalResourcesQuery = queryOptions({
  queryKey: qk.viewer.portalResources,
  queryFn: () => getPortalResources(),
  staleTime: 10_000,
});
