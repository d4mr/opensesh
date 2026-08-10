import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/public-page";
export const Route = createFileRoute("/e/$eventSlug/itinerary")({ component: Page });
function Page() {
  return <PublicPage eventSlug={Route.useParams().eventSlug} view="itinerary" />;
}
