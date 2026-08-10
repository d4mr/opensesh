import { createFileRoute } from "@tanstack/react-router";

import { PagePlaceholder } from "@/components/app/page-placeholder";

const titles: Readonly<Record<string, string>> = {
  abstracts: "Abstracts",
  sessions: "Sessions",
  forms: "Forms",
  evaluation: "Evaluation",
  agenda: "Agenda",
  tasks: "Tasks",
  "portal-forms": "Portal Forms",
  "file-requests": "File Requests",
  settings: "Settings",
};

export const Route = createFileRoute("/admin/$section")({ component: AdminPage });

function AdminPage() {
  const { section } = Route.useParams();
  return <PagePlaceholder title={titles[section] ?? "Program"} />;
}
