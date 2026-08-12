import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { listApiKeys } from "@/server-fns/api-keys";
import { getOrganizationSettings } from "@/server-fns/organization";

export const organizationSettingsQuery = queryOptions({
  queryKey: qk.org.settings,
  queryFn: () => getOrganizationSettings(),
  staleTime: 30_000,
});

export const apiKeysQuery = queryOptions({
  queryKey: qk.org.apiKeys,
  queryFn: () => listApiKeys(),
  staleTime: 30_000,
});
