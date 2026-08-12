import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { resolveActiveEvent } from "@/lib/active-event";
import { PagePlaceholder } from "@/components/app/page-placeholder";
import { PortalAdminSection } from "@/components/admin/portal-admin";
import { ResourcesAdmin } from "@/components/admin/resources-admin";
import { adminPortalQuery } from "@/lib/portal-queries";
import { adminResourcesQuery } from "@/lib/resource-queries";
import { adminEventsQuery } from "@/lib/review-desk-queries";

const titles: Readonly<Record<string, string>> = {
  sessions: "Sessions",
  content: "Content",
  forms: "Forms",
  evaluation: "Evaluation",
  agenda: "Agenda",
  widgets: "Widgets",
  tasks: "Tasks",
  "portal-forms": "Portal Forms",
  "file-requests": "File Requests",
  resources: "Resources",
  settings: "Settings",
};

export const Route = createFileRoute("/admin/$section")({
  validateSearch: (search: Record<string, unknown>) => ({
    spotlight: typeof search.spotlight === "string" ? search.spotlight : undefined,
    fileRequest: typeof search.fileRequest === "string" ? search.fileRequest : undefined,
  }),
  loader: async ({ context, params }) => {
    if (
      !["tasks", "portal-forms", "file-requests", "content", "resources"].includes(params.section)
    )
      return;
    const events = await context.queryClient.ensureQueryData(adminEventsQuery);
    const eventId = events.ok
      ? resolveActiveEvent(events.data, context.activeEventId)?.id
      : undefined;
    if (eventId === undefined) return;
    if (params.section === "resources") {
      await context.queryClient.ensureQueryData(adminResourcesQuery(eventId));
      return;
    }
    await context.queryClient.ensureQueryData(adminPortalQuery(eventId));
  },
  component: AdminPage,
});

function AdminPage() {
  const { section } = Route.useParams();
  const { spotlight, fileRequest } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (section === "resources") {
    return (
      <ResourcesAdmin
        spotlightId={spotlight}
        onSpotlightChange={(id, options) =>
          void navigate({
            search: { spotlight: id, fileRequest },
            replace: options.replace,
          })
        }
      />
    );
  }
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
