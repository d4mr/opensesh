import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/public-page";
export const Route = createFileRoute("/e/$eventSlug/speakers")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Page,
});
function Page() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { q } = Route.useSearch();
  return (
    <PublicPage
      eventSlug={Route.useParams().eventSlug}
      view="speakers"
      speakerSearch={q ?? ""}
      onSpeakerSearchChange={(value) => void navigate({ replace: true, search: { q: value } })}
    />
  );
}
