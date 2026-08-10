import { MagicLinkRequest } from "@opensesh/domain/server/schema/auth";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { Schema } from "effect";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicEvent, requestMagicLink } from "@/server-fns/auth";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const event = useQuery({
    queryKey: ["event", "ai-engineer-nyc-2026"],
    queryFn: () => getPublicEvent(),
  });
  const [sent, setSent] = useState<{ readonly email: string; readonly demoLink?: string }>();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: Schema.toStandardSchemaV1(MagicLinkRequest) },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await requestMagicLink({ data: value });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSent({
        email: value.email,
        ...(result.data.demoLink === undefined ? {} : { demoLink: result.data.demoLink }),
      });
    },
  });

  const eventName = event.data?.ok ? event.data.data.name : "AI.Engineer Sandbox — NYC 2026";

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{eventName}</CardTitle>
          <CardDescription>Sign in with a secure link sent to your email.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent === undefined ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Email</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </form.Field>
              {error === undefined ? null : <p className="text-sm text-destructive">{error}</p>}
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button className="pressable w-full" type="submit" disabled={!canSubmit}>
                    {isSubmitting ? "Sending…" : "Email me a magic link"}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          ) : (
            <div className="text-center">
              <MailCheckIcon className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 font-semibold">Check your email</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a sign-in link to {sent.email}.
              </p>
              {sent.demoLink === undefined ? null : (
                <Button className="pressable mt-5" asChild>
                  <a href={sent.demoLink}>Open demo magic link</a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
