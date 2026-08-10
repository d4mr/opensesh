import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/public-page";

export const Route = createFileRoute("/e/$eventSlug/agenda")({
  component: PublicAgendaRoute,
});

function PublicAgendaRoute() {
  return <PublicPage eventSlug={Route.useParams().eventSlug} view="agenda" />;
}
