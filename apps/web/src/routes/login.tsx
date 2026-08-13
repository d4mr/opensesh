import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { LoginForm } from "@/components/login-form";
import { switchDemoPersona } from "@/server-fns/auth";

const demoPersonaByRole: Record<string, DemoPersonaEmail> = {
  organizer: "dana@demo.opensesh.io",
  reviewer: "rey@demo.opensesh.io",
  speaker: "maya@demo.opensesh.io",
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: typeof search.demo === "string" ? search.demo : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    error: search.error === "portal-link" ? ("portal-link" as const) : undefined,
    // In-app destination to resume after sign-in (a portal deep link that
    // bounced here). Same-origin paths only.
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : undefined,
  }),
  component: Login,
});

function Login() {
  const { demo, email, error, redirect } = Route.useSearch();
  const demoEmail = demo === undefined ? undefined : demoPersonaByRole[demo];
  const [demoFailed, setDemoFailed] = useState(false);
  const attempted = useRef(false);
  // When an OAuth authorize redirect landed here (an MCP client connecting),
  // carry its full query so sign-in can resume the authorization instead of
  // dropping the user at the dashboard. Read post-mount: the raw query holds
  // params validateSearch doesn't model.
  const [resumeUrl, setResumeUrl] = useState<string>();
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.has("client_id") && search.has("response_type")) {
      setResumeUrl(`/api/auth/mcp/authorize${window.location.search}`);
    }
  }, []);

  // Landing-page deep link (/login?demo=organizer): sign straight into the
  // demo-workspace persona; fall back to the normal form if that fails.
  useEffect(() => {
    if (demoEmail === undefined || attempted.current) {
      return;
    }
    attempted.current = true;
    void switchDemoPersona({ data: { email: demoEmail } }).then((result) => {
      if (result.ok) {
        window.location.assign(result.data.target);
        return;
      }
      setDemoFailed(true);
    });
  }, [demoEmail]);

  if (demoEmail !== undefined && !demoFailed) {
    return (
      <LoginBackdrop>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Signing you in to the demo…
        </p>
      </LoginBackdrop>
    );
  }

  return (
    <LoginBackdrop>
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm
          initialEmail={email}
          resumeUrl={resumeUrl}
          redirectPath={redirect}
          notice={
            error === "portal-link"
              ? "That portal link has expired. Enter your email and we'll send a fresh sign-in link."
              : undefined
          }
        />
      </div>
    </LoginBackdrop>
  );
}

function LoginBackdrop({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <img
        src="/art/renaissance-salon-full-green-haze.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-background/50 dark:bg-background/65" />
      <div className="relative z-10 flex w-full flex-col items-center">{children}</div>
    </main>
  );
}
