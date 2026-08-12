import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getCrmContact, getCrmWorkspace } from "@/server-fns/crm";

export const crmWorkspaceQuery = queryOptions({
  queryKey: qk.org.crm,
  queryFn: () => getCrmWorkspace(),
  staleTime: 30_000,
});

export const crmContactQuery = (id: string) =>
  queryOptions({
    queryKey: qk.org.crmContact(id),
    queryFn: () => getCrmContact({ data: { id } }),
    staleTime: 30_000,
  });
