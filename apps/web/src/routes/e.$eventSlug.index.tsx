import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/e/$eventSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/e/$eventSlug/sessions", params });
  },
});
