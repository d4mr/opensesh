import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SpeakersDirectory } from "@/components/admin/speakers-directory";
import { speakerDirectoryQuery } from "@/lib/widget-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

export const Route = createFileRoute("/admin/speakers")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined)
      await context.queryClient.ensureQueryData(speakerDirectoryQuery(eventId));
  },
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
