import { createFileRoute, redirect } from "@tanstack/react-router";

import { qk } from "@/lib/query-keys";
import { getViewer } from "@/server-fns/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Shares the portal guard's cache key so the follow-up redirect is instant.
    const viewer = await context.queryClient.ensureQueryData({
      queryKey: qk.viewer.portal,
      queryFn: () => getViewer(),
      staleTime: 5 * 60_000,
    });
    if (!viewer.ok) {
      throw redirect({ to: viewer.error.status === 428 ? "/onboarding" : "/login" });
    }
    if (viewer.data.roles.admin || viewer.data.roles.reviewer || viewer.data.roles.member) {
      throw redirect({ to: "/admin" });
    }
    if (viewer.data.roles.contactId !== undefined) throw redirect({ to: "/portal" });
    throw redirect({ to: "/onboarding", search: { new: undefined } });
  },
});
