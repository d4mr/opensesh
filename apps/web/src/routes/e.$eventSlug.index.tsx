import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { publicProgramQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/e/$eventSlug/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProgramQuery(params.eventSlug)),
  component: PublicEventIndex,
});

function PublicEventIndex() {
  const { eventSlug } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  const { event } = program.data.data;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{event.tagline ?? event.name}</h1>
      {event.description === null ? null : (
        <div
          className="rte-content mt-4 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      )}
    </main>
  );
}
