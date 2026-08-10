import { createFileRoute } from "@tanstack/react-router";

import { EmailViewer } from "@/components/admin/email-viewer";

export const Route = createFileRoute("/admin/emails")({
  component: EmailViewer,
});
