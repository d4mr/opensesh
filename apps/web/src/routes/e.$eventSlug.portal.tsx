import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { EventIcon } from "@/components/app/event-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { storePortalEventSlug } from "@/lib/portal-event";
import { publicProgramQuery } from "@/lib/widget-queries";
import { requestMagicLink } from "@/server-fns/auth";

// The event-branded speaker sign-in page. Speakers normally arrive through
// tokened email links and never see it; this catches expired links, typed
// URLs, and other organic visits without confronting an event's speakers
// with the organizer-flavored opensesh login.
export const Route = createFileRoute("/e/$eventSlug/portal")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicProgramQuery(params.eventSlug)),
  component: EventPortalSignIn,
});

function EventPortalSignIn() {
  const { eventSlug } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string>();
  const [error, setError] = useState<string>();

  if (!program.data.ok) {
    return (
      <main className="grid place-items-center px-4 py-24">
        <p className="text-sm text-muted-foreground">{program.data.error.message}</p>
      </main>
    );
  }
  const { event } = program.data.data;

  const send = async () => {
    if (email.trim().length === 0) {
      setError("Enter your email first");
      return;
    }
    setError(undefined);
    setSending(true);
    // Pin the portal to this event before the link lands, so the click
    // opens the event the speaker asked for — not an arbitrary one.
    storePortalEventSlug(eventSlug);
    const result = await requestMagicLink({
      data: { email: email.trim(), callbackUrl: "/portal" },
    });
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(email.trim());
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col items-center px-4 py-16 md:py-24">
      <Card className="w-full">
        <CardContent className="p-6 md:p-8">
          {sent === undefined ? (
            <form
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                void send();
              }}
            >
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <EventIcon src={event.logoUrl} size={48} className="mb-1 rounded-lg" />
                  <h1 className="text-xl font-semibold tracking-tight">Speaker portal</h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    Sign in to manage your sessions, tasks, and profile for {event.name}.
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="portal-email">Email</FieldLabel>
                  <Input
                    id="portal-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(inputEvent) => setEmail(inputEvent.target.value)}
                  />
                  <FieldDescription>
                    Use the address your speaker invitation was sent to.
                  </FieldDescription>
                </Field>
                {error === undefined ? null : (
                  <FieldDescription className="text-destructive">{error}</FieldDescription>
                )}
                <Field>
                  <Button type="submit" disabled={sending}>
                    {sending ? "Sending…" : "Email me a sign-in link"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <MailCheckIcon className="size-8 text-primary" />
              <h1 className="mt-4 text-lg font-semibold">Check your email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a sign-in link to {sent}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <BrandMark className="size-4 rounded-sm" /> Powered by opensesh
      </p>
    </main>
  );
}
