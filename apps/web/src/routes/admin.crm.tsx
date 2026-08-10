import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CrmWorkspacePage } from "@/components/crm/crm-workspace";
import { crmWorkspaceQuery } from "@/lib/crm-queries";

const tabs = ["directory", "pipeline", "segments", "overview"] as const;
type CrmTab = (typeof tabs)[number];
const isCrmTab = (value: unknown): value is CrmTab =>
  value === "directory" || value === "pipeline" || value === "segments" || value === "overview";

export const Route = createFileRoute("/admin/crm")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: isCrmTab(search.tab) ? search.tab : "directory",
    contact: typeof search.contact === "string" ? search.contact : undefined,
    segment: typeof search.segment === "string" ? search.segment : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(crmWorkspaceQuery),
  component: CrmRoute,
});

function CrmRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <CrmWorkspacePage
      {...search}
      navigate={(next, replace = false) => void navigate({ search: next, replace })}
    />
  );
}
