import { queryOptions } from "@tanstack/react-query";

import { listApiKeys } from "@/server-fns/api-keys";
import { getOrganizationSettings } from "@/server-fns/organization";

export const organizationSettingsQuery = queryOptions({
  queryKey: ["organization-settings"],
  queryFn: () => getOrganizationSettings(),
  staleTime: 30_000,
});

export const apiKeysQuery = queryOptions({
  queryKey: ["organization-api-keys"],
  queryFn: () => listApiKeys(),
  staleTime: 30_000,
});
