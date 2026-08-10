import { createFileRoute } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/app/page-placeholder";

export const Route = createFileRoute("/portal/")({
  component: () => <PagePlaceholder title="Home" />,
});
