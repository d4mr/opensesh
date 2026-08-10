import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/app/page-placeholder";
import { PortalAdminSection } from "@/components/admin/portal-admin";
import { adminPortalQuery } from "@/lib/portal-queries";

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
  }),
  loader: ({ context, params }) =>
    ["tasks", "portal-forms", "file-requests", "content"].includes(params.section)
      ? context.queryClient.ensureQueryData(adminPortalQuery("evt_aie_nyc_2026"))
      : undefined,
  component: AdminPage,
});

function AdminPage() {
  const { section } = Route.useParams();
  const { spotlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  if (["tasks", "portal-forms", "file-requests", "content"].includes(section)) {
    return (
      <PortalAdminSection
        section={section}
        spotlightId={spotlight}
        onSpotlightChange={(id, options) =>
          void navigate({ search: { spotlight: id }, replace: options.replace })
        }
      />
    );
  }
  return <PagePlaceholder title={titles[section] ?? "Program"} />;
}
