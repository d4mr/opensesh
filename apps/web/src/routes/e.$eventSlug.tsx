import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/app/public-shell";
import { RouteError } from "@/components/app/route-error";
import { publicProgramQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/e/$eventSlug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProgramQuery(params.eventSlug)),
  component: EventLayout,
});

function EventLayout() {
  const { eventSlug } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  if (!program.data.ok) return <RouteError error={program.data.error} fullScreen />;
  return <PublicShell event={program.data.data.event} />;
}
