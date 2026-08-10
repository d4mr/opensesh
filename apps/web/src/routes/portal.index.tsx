import { createFileRoute } from "@tanstack/react-router";

import { PortalHome } from "@/components/portal/portal-home";

export const Route = createFileRoute("/portal/")({
  component: PortalHome,
});
