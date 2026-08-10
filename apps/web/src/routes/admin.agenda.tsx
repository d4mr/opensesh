import type { AgendaView } from "@opensesh/domain";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AgendaPage } from "@/components/agenda/agenda-page";
import { agendaQuery } from "@/lib/agenda-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

const parseView = (value: unknown): AgendaView =>
  value === "list" || value === "conflicts" ? value : "rooms";

const parseDay = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

export const Route = createFileRoute("/admin/agenda")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: parseView(search.view),
    day: parseDay(search.day),
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) await context.queryClient.ensureQueryData(agendaQuery(eventId));
  },
  component: AgendaRoute,
});

function AgendaRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <AgendaPage
      view={search.view}
      day={search.day}
      navigate={(view, day) => void navigate({ search: { view, day }, replace: true })}
    />
  );
}
