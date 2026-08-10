import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SpeakersDirectory } from "@/components/admin/speakers-directory";
import { speakerDirectoryQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/admin/speakers")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(speakerDirectoryQuery("evt_aie_nyc_2026")),
  component: SpeakersRoute,
});

function SpeakersRoute() {
  const { spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SpeakersDirectory
      spotlightId={spotlight}
      onSpotlightChange={(id, options) =>
        void navigate({ search: { spotlight: id }, replace: options.replace })
      }
    />
  );
}
