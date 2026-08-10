import { createFileRoute } from "@tanstack/react-router";

import { PortalProfile } from "@/components/portal/portal-profile";
import { PortalSubmissions } from "@/components/portal/portal-submissions";
import { PortalTasks } from "@/components/portal/portal-tasks";
import { speakerPortalQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/portal/$section")({
  loader: ({ context }) => context.queryClient.ensureQueryData(speakerPortalQuery),
  component: PortalPage,
});

function PortalPage() {
  const { section } = Route.useParams();
  if (section === "submissions") return <PortalSubmissions />;
  if (section === "profile") return <PortalProfile />;
  if (section === "tasks") return <PortalTasks />;
  return <p className="p-6 text-sm text-muted-foreground">Portal page not found.</p>;
}
