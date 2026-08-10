import { createFileRoute } from "@tanstack/react-router";

import { SpeakersDirectory } from "@/components/admin/speakers-directory";
import { speakerDirectoryQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/admin/speakers")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(speakerDirectoryQuery("evt_aie_nyc_2026")),
  component: SpeakersDirectory,
});
