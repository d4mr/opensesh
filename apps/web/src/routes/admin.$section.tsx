import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/app/page-placeholder";
import { PortalAdminSection } from "@/components/admin/portal-admin";
import { adminPortalQuery } from "@/lib/portal-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

const titles: Readonly<Record<string, string>> = {
  abstracts: "Abstracts",
  sessions: "Sessions",
  content: "Content",
  forms: "Forms",
  evaluation: "Evaluation",
  agenda: "Agenda",
  widgets: "Widgets",
  tasks: "Tasks",
  "portal-forms": "Portal Forms",
  "file-requests": "File Requests",
  settings: "Settings",
};

export const Route = createFileRoute("/admin/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
    fileRequest: typeof search.fileRequest === "string" ? search.fileRequest : undefined,
  }),
  loader: async ({ context, params }) => {
    if (!["tasks", "portal-forms", "file-requests", "content"].includes(params.section)) return;
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok ? events.data[0]?.id : undefined;
    if (eventId !== undefined) await context.queryClient.ensureQueryData(adminPortalQuery(eventId));
  },
  component: AdminPage,
});

function AdminPage() {
  const { section } = Route.useParams();
  const { spotlight, fileRequest } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (["tasks", "portal-forms", "file-requests", "content"].includes(section)) {
    return (
      <PortalAdminSection
        section={section}
        spotlightId={spotlight}
        fileRequestId={fileRequest}
        onSpotlightChange={(id, options) =>
          void navigate({
            search: { spotlight: id, fileRequest },
            replace: options.replace,
          })
        }
      />
    );
  }
  return <PagePlaceholder title={titles[section] ?? "Program"} />;
}
