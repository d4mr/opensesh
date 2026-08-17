import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { LoginForm } from "@/components/login-form";
import { switchDemoPersona } from "@/server-fns/auth";

const demoPersonaByRole: Record<
  string,
  { readonly email: DemoPersonaEmail; readonly name: string; readonly destination: string }
> = {
  organizer: {
    email: "dana@demo.opensesh.io",
    name: "Dana",
    destination: "the organizer workspace",
  },
  reviewer: { email: "rey@demo.opensesh.io", name: "Rey", destination: "the review queue" },
  speaker: { email: "maya@demo.opensesh.io", name: "Maya", destination: "the speaker portal" },
};

const noticeByError = {
  "portal-link":
    "That portal link has expired. Enter your email and we'll send a fresh sign-in link.",
  session: "You were signed out. Sign in again to pick up where you left off.",
} as const;

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: typeof search.demo === "string" ? search.demo : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    error:
      search.error === "portal-link" || search.error === "session"
        ? (search.error as keyof typeof noticeByError)
        : undefined,
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
  const persona = demo === undefined ? undefined : demoPersonaByRole[demo];
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
    if (persona === undefined || attempted.current) {
      return;
    }
    attempted.current = true;
    void switchDemoPersona({ data: { email: persona.email } }).then((result) => {
      if (result.ok) {
        window.location.assign(result.data.target);
        return;
      }
      setDemoFailed(true);
    });
  }, [persona]);

  if (persona !== undefined && !demoFailed) {
    return (
      <LoginBackdrop>
        <div
          aria-live="polite"
          className="flex w-full max-w-xs flex-col items-center rounded-xl border bg-card p-8 text-center shadow-lg"
        >
          <BrandMark className="size-9" />
          <h1 className="mt-4 text-base font-semibold tracking-tight">
            Signing you in to the demo
          </h1>
          <p className="mt-1 text-sm text-balance text-muted-foreground">
            Opening {persona.destination} as {persona.name}…
          </p>
          <LoaderCircleIcon className="mt-5 size-4 animate-spin text-muted-foreground" />
          <p className="mt-5 w-full border-t pt-4 text-xs text-muted-foreground">
            Shared sandbox — everyone's edits reset every 15 minutes.
          </p>
        </div>
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
            demoFailed
              ? "Demo sign-in didn't go through — try the link again, or sign in below."
              : error === undefined
                ? undefined
                : noticeByError[error]
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
