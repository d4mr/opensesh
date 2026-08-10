import { createFileRoute } from "@tanstack/react-router";

import { SpeakersDirectory } from "@/components/admin/speakers-directory";
import { adminPortalQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/admin/speakers")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(adminPortalQuery("evt_aie_nyc_2026")),
  component: SpeakersDirectory,
});
