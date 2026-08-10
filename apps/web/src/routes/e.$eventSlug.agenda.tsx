import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PublicAgenda } from "@/components/agenda/public-agenda";
import { publicAgendaQuery } from "@/lib/agenda-queries";

export const Route = createFileRoute("/e/$eventSlug/agenda")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicAgendaQuery(params.eventSlug)),
  component: PublicAgendaRoute,
});

function PublicAgendaRoute() {
  const { eventSlug } = Route.useParams();
  const agenda = useSuspenseQuery(publicAgendaQuery(eventSlug));
  if (!agenda.data.ok) return <p className="p-6 text-sm">{agenda.data.error.message}</p>;
  return <PublicAgenda agenda={agenda.data.data} />;
}
