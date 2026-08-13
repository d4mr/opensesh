import { createFileRoute, redirect } from "@tanstack/react-router";

// The pretty URL speaker emails carry. It hands the token to the auth
// endpoint, which exchanges it for a session pinned to the contact's event
// and forwards to the requested portal page.
export const Route = createFileRoute("/portal_/access/$token")({
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search.to === "string" && search.to.startsWith("/portal") ? search.to : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    const query = new URLSearchParams({
      token: params.token,
      callbackURL: search.to ?? "/portal",
    });
    throw redirect({ href: `/api/auth/portal-access/verify?${query.toString()}` });
  },
});
