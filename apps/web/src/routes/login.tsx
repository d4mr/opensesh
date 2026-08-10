import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { LoginForm } from "@/components/login-form";
import { switchDemoPersona } from "@/server-fns/auth";

const demoPersonaByRole: Record<string, DemoPersonaEmail> = {
  organizer: "demo@opensesh.io",
  reviewer: "reviewer@opensesh.io",
  speaker: "maya.chen@retrievallabs.ai",
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) =>
    typeof search.demo === "string" ? { demo: search.demo } : {},
  component: Login,
});

function Login() {
  const { demo } = Route.useSearch();
  const demoEmail = demo === undefined ? undefined : demoPersonaByRole[demo];
  const [demoFailed, setDemoFailed] = useState(false);
  const attempted = useRef(false);

  // Landing-page deep link (/login?demo=organizer): sign straight into the
  // persona when demo mode is on; fall back to the normal form otherwise.
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
      <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Signing you in to the demo…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </main>
  );
}
