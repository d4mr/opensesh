import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/app/public-shell";
import { getPublicEvent } from "@/server-fns/auth";

const publicEventQuery = queryOptions({
  queryKey: ["public-event"],
  queryFn: () => getPublicEvent(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/e")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicEventQuery),
  component: EventLayout,
});

function EventLayout() {
  const event = useSuspenseQuery(publicEventQuery);
  if (!event.data.ok) return <p className="p-6">{event.data.error.message}</p>;
  return <PublicShell eventName={event.data.data.name} />;
}
