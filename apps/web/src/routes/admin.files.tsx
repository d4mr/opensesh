import { createFileRoute } from "@tanstack/react-router";

import { FilesLibrary } from "@/components/admin/files-library";
import { adminPortalQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/admin/files")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
    deliverable: typeof search.deliverable === "string" ? search.deliverable : undefined,
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminPortalQuery("evt_aie_nyc_2026")),
  component: FilesRoute,
});

function FilesRoute() {
  const search = Route.useSearch();
  return <FilesLibrary spotlightId={search.spotlight} deliverableId={search.deliverable} />;
}
