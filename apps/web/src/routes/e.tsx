import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/app/public-shell";
import { getPublicEvent } from "@/server-fns/auth";

export const Route = createFileRoute("/e")({ component: EventLayout });

function EventLayout() {
  const event = useQuery({ queryKey: ["public-event"], queryFn: () => getPublicEvent() });
  if (event.data === undefined) return null;
  if (!event.data.ok) return <p className="p-6">{event.data.error.message}</p>;
  return <PublicShell eventName={event.data.data.name} />;
}
