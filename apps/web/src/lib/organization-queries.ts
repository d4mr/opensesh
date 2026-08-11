import { queryOptions } from "@tanstack/react-query";

import { getOrganizationSettings } from "@/server-fns/organization";

export const organizationSettingsQuery = queryOptions({
  queryKey: ["organization-settings"],
  queryFn: () => getOrganizationSettings(),
  staleTime: 30_000,
});
