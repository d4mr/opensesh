import { queryOptions } from "@tanstack/react-query";

import { getCrmContact, getCrmWorkspace } from "@/server-fns/crm";

export const crmWorkspaceQuery = queryOptions({
  queryKey: ["crm-workspace"],
  queryFn: () => getCrmWorkspace(),
  staleTime: 30_000,
});

export const crmContactQuery = (id: string) =>
  queryOptions({
    queryKey: ["crm-contact", id],
    queryFn: () => getCrmContact({ data: { id } }),
    staleTime: 30_000,
  });
