import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/public-page";

const list = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? value.split(",").filter((item) => item !== "")
      : undefined;

export const Route = createFileRoute("/e/$eventSlug/sessions")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    track: list(search.track),
    format: list(search.format),
    room: list(search.room),
  }),
  component: Page,
});
function Page() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  return (
    <PublicPage
      eventSlug={Route.useParams().eventSlug}
      view="sessions"
      sessionState={{
        query: search.q ?? "",
        trackIds: search.track ?? [],
        formatIds: search.format ?? [],
        rooms: search.room ?? [],
      }}
      onSessionStateChange={(state) =>
        void navigate({
          replace: true,
          search: {
            q: state.query,
            track: [...state.trackIds],
            format: [...state.formatIds],
            room: [...state.rooms],
          },
        })
      }
    />
  );
}
