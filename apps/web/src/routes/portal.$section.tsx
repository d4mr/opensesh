import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PortalProfile } from "@/components/portal/portal-profile";
import { PortalSessions } from "@/components/portal/portal-sessions";
import { PortalSubmissions } from "@/components/portal/portal-submissions";
import { PortalTasks } from "@/components/portal/portal-tasks";
import { PortalResources } from "@/components/portal/portal-resources";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { portalResourcesQuery } from "@/lib/resource-queries";

export const Route = createFileRoute("/portal/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loader: ({ context, params }) =>
    params.section === "resources"
      ? context.queryClient.ensureQueryData(portalResourcesQuery)
      : context.queryClient.ensureQueryData(speakerPortalQuery),
  component: PortalPage,
});

function PortalPage() {
  const { section } = Route.useParams();
  const { spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (section === "submissions")
    return (
      <PortalSubmissions
        spotlightId={spotlight}
        onSpotlightChange={(id, options) =>
          void navigate({ search: { spotlight: id }, replace: options.replace })
        }
      />
    );
  if (section === "sessions") return <PortalSessions />;
  if (section === "profile") return <PortalProfile />;
  if (section === "tasks") return <PortalTasks />;
  if (section === "resources") return <PortalResources />;
  return <p className="p-6 text-sm text-muted-foreground">Portal page not found.</p>;
}
