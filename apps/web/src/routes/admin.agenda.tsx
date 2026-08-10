import type { AgendaView } from "@opensesh/domain";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AgendaPage } from "@/components/agenda/agenda-page";
import { agendaDraftsQuery, agendaQuery } from "@/lib/agenda-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

const parseView = (value: unknown): AgendaView =>
  value === "list" || value === "conflicts" ? value : "rooms";

const parseDay = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

export const Route = createFileRoute("/admin/agenda")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: parseView(search.view),
    day: parseDay(search.day),
    draft: typeof search.draft === "string" && search.draft.length > 0 ? search.draft : undefined,
  }),
  loader: async ({ context }) => {
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) {
      await Promise.all([
        context.queryClient.ensureQueryData(agendaQuery(eventId)),
        context.queryClient.ensureQueryData(agendaDraftsQuery(eventId)),
      ]);
    }
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
      draftId={search.draft}
      navigate={(view, day, draft) =>
        void navigate({ search: { view, day, draft }, replace: true })
      }
    />
  );
}
