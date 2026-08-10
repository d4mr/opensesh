import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/app/public-shell";
import { publicProgramQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/e/$eventSlug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProgramQuery(params.eventSlug)),
  component: EventLayout,
});

function EventLayout() {
  const { eventSlug } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  return <PublicShell event={program.data.data.event} />;
}
