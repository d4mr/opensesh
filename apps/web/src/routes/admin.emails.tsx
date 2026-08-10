import { createFileRoute } from "@tanstack/react-router";

import { EmailViewer } from "@/components/admin/email-viewer";

export const Route = createFileRoute("/admin/emails")({
  validateSearch: (search: Record<string, unknown>): { readonly email?: string } => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: EmailViewer,
});
