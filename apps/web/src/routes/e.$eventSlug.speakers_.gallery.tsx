import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/public-page";
export const Route = createFileRoute("/e/$eventSlug/speakers_/gallery")({ component: Page });
function Page() {
  return <PublicPage eventSlug={Route.useParams().eventSlug} view="speaker_gallery" />;
}
