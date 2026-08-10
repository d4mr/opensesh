import { createFileRoute, redirect } from "@tanstack/react-router";

import { getViewer } from "@/server-fns/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const viewer = await getViewer();
    if (!viewer.ok) {
      throw redirect({ to: "/login" });
    }
    if (viewer.data.roles.admin || viewer.data.roles.reviewer) {
      throw redirect({ to: "/admin" });
    }
    throw redirect({ to: "/portal" });
  },
});
