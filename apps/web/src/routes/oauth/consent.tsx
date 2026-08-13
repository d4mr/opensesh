import { createFileRoute } from "@tanstack/react-router";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleUserIcon,
  FingerprintIcon,
  MailIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOauthClient, getViewer } from "@/server-fns/auth";

// The OAuth consent screen for MCP clients. Every /mcp/authorize request is
// forced through here (the auth route boundary injects prompt=consent), so a
// token is never minted without the user seeing who asked and what they get.
// The flow ends in an explicit Connected / Declined state before the redirect
// back to the client — never a silent hop.

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    consent_code: typeof search.consent_code === "string" ? search.consent_code : undefined,
    client_id: typeof search.client_id === "string" ? search.client_id : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
  component: ConsentPage,
});

const SCOPE_COPY: Record<
  string,
  { readonly icon: typeof MailIcon; readonly label: string; readonly detail: string }
> = {
  openid: {
    icon: FingerprintIcon,
    label: "Confirm who you are",
    detail: "Your opensesh identity",
  },
  profile: {
    icon: CircleUserIcon,
    label: "See your name",
    detail: "Shown on the actions it takes as you",
  },
  email: {
    icon: MailIcon,
    label: "See your email address",
    detail: "Used to identify your account",
  },
  offline_access: {
    icon: RefreshCwIcon,
    label: "Stay connected",
    detail: "No repeat sign-ins; disconnect anytime",
  },
};

interface Viewer {
  readonly name: string;
  readonly email: string;
  readonly organizationName: string;
}

type ConsentState =
  | { readonly kind: "loading" }
  | { readonly kind: "review"; readonly viewer: Viewer }
  | { readonly kind: "connected"; readonly viewer: Viewer }
  | { readonly kind: "declined" }
  | { readonly kind: "expired" };

function ConsentPage() {
  const { consent_code, client_id, scope } = Route.useSearch();
  const [state, setState] = useState<ConsentState>({ kind: "loading" });
  const [clientName, setClientName] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const redirectTimer = useRef<number>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (consent_code === undefined || client_id === undefined) {
      setState({ kind: "expired" });
      return;
    }
    void Promise.all([getViewer(), getOauthClient({ data: { clientId: client_id } })]).then(
      ([viewer, client]) => {
        if (cancelled) return;
        if (!viewer.ok) {
          setState({ kind: "expired" });
          return;
        }
        if (client.ok && client.data !== null) setClientName(client.data.name);
        setState({
          kind: "review",
          viewer: {
            name: viewer.data.name,
            email: viewer.data.email,
            organizationName: viewer.data.organizationName,
          },
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [consent_code, client_id]);

  useEffect(
    () => () => {
      if (redirectTimer.current !== undefined) window.clearTimeout(redirectTimer.current);
    },
    [],
  );

  const client = clientName ?? "This app";

  const decide = async (accept: boolean) => {
    if (state.kind !== "review") return;
    setBusy(true);
    setError(undefined);
    const response = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept, consent_code }),
    });
    if (!response.ok) {
      setBusy(false);
      if (response.status === 401) {
        setState({ kind: "expired" });
        return;
      }
      setError("Something went wrong. Try again, or start over from the app.");
      return;
    }
    const { redirectURI } = (await response.json()) as { readonly redirectURI: string };
    setState(accept ? { kind: "connected", viewer: state.viewer } : { kind: "declined" });
    redirectTimer.current = window.setTimeout(() => {
      window.location.assign(redirectURI);
    }, 1600);
  };

  const scopes = (scope ?? "").split(" ").filter((entry) => entry in SCOPE_COPY);

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-muted p-6">
      <img
        src="/art/outdoor-marble-stoa-conversations.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-background/50 dark:bg-background/65" />
      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden p-0">
          {state.kind === "loading" ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground" aria-busy="true">
              Preparing your connection…
            </div>
          ) : state.kind === "review" ? (
            <div key="review" className="wizard-step">
              <div className="px-6 pt-8">
                <ConnectionArt client={client} linked={false} />
                <h1 className="mt-5 text-center text-xl font-semibold tracking-tight">
                  Connect {client} to opensesh
                </h1>
                <p className="mt-1.5 text-balance text-center text-sm text-muted-foreground">
                  {client} will act as you in {state.viewer.organizationName} — it can only see and
                  do what your role allows.
                </p>
                {scopes.length > 0 ? (
                  <div className="mt-5 divide-y rounded-lg border">
                    {scopes.map((entry) => {
                      const copy = SCOPE_COPY[entry];
                      if (copy === undefined) return null;
                      return (
                        <div key={entry} className="flex items-center gap-3 px-3 py-2.5">
                          <copy.icon
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{copy.label}</p>
                            <p className="text-xs text-muted-foreground">{copy.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
                  {busy
                    ? "Connecting…"
                    : error !== undefined
                      ? error
                      : `Signed in as ${state.viewer.name} · ${state.viewer.email}`}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t px-6 py-4">
                <Button
                  variant="ghost"
                  className="pressable"
                  disabled={busy}
                  onClick={() => void decide(false)}
                >
                  Deny
                </Button>
                <Button className="pressable" disabled={busy} onClick={() => void decide(true)}>
                  Connect
                </Button>
              </div>
            </div>
          ) : state.kind === "connected" ? (
            <div key="connected" className="wizard-step px-6 py-10 text-center">
              <ConnectionArt client={client} linked />
              <div className="wizard-pop mx-auto mt-6 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
                <CheckIcon className="size-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Connected</h1>
              <p className="mt-1.5 text-balance text-sm text-muted-foreground">
                {client} is now connected and will act as {state.viewer.name}. Taking you back…
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                If nothing happens, it's safe to close this tab.
              </p>
            </div>
          ) : state.kind === "declined" ? (
            <div key="declined" className="wizard-step px-6 py-10 text-center">
              <div className="wizard-pop mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <XIcon className="size-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Connection declined</h1>
              <p className="mt-1.5 text-balance text-sm text-muted-foreground">
                {client} was not given access. Taking you back…
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                If nothing happens, it's safe to close this tab.
              </p>
            </div>
          ) : (
            <div key="expired" className="wizard-step px-6 py-10 text-center">
              <div className="wizard-pop mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <CircleAlertIcon className="size-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                This request has expired
              </h1>
              <p className="mt-1.5 text-balance text-sm text-muted-foreground">
                Connection requests are valid for ten minutes. Start the connection again from{" "}
                {client === "This app" ? "your MCP client" : client}.
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

// The two apps as tiles joined by a link line: dashes drift while the request
// is under review; the line turns solid once connected.
function ConnectionArt({ client, linked }: { readonly client: string; readonly linked: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-background">
        <BrandMark className="size-7" />
      </div>
      <svg width="72" height="24" viewBox="0 0 72 24" className="shrink-0" aria-hidden="true">
        <line
          x1="4"
          y1="12"
          x2="68"
          y2="12"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={linked ? "stroke-primary" : "consent-link stroke-border"}
        />
        {linked ? <circle cx="36" cy="12" r="3" className="fill-primary" /> : null}
      </svg>
      <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-background">
        <span className="text-sm font-semibold uppercase text-muted-foreground">
          {client.slice(0, 1)}
        </span>
      </div>
    </div>
  );
}
