import { createFileRoute } from "@tanstack/react-router";

import { CommunicationsPage } from "@/components/admin/communications-page";
import { communicationCenterQuery } from "@/lib/communication-queries";

export const Route = createFileRoute("/admin/communications")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(communicationCenterQuery("evt_aie_nyc_2026")),
  component: CommunicationsPage,
});
