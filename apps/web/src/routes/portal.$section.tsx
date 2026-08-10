import { createFileRoute } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/app/page-placeholder";

const titles: Readonly<Record<string, string>> = {
  submissions: "Submissions",
  profile: "Profile",
  tasks: "Tasks",
};

export const Route = createFileRoute("/portal/$section")({ component: PortalPage });

function PortalPage() {
  const { section } = Route.useParams();
  return <PagePlaceholder title={titles[section] ?? "Portal"} />;
}
