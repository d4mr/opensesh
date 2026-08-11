import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestMagicLink } from "@/server-fns/auth";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ readonly email: string; readonly demoLink?: string }>();
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await requestMagicLink({
        data: { email: value.email, callbackUrl: "/onboarding" },
      });
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

  return (
    <main className="min-h-svh bg-background">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <BrandMark className="size-6" />
        <span className="text-sm font-semibold tracking-tight">opensesh</span>
      </header>
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-sm items-center px-5 py-12">
        {sent === undefined ? (
          <form
            className="wizard-step w-full"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start with your work email. No password required.
            </p>
            <form.Field name="email">
              {(field) => (
                <Field className="mt-6">
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    placeholder="you@company.com"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            {error === undefined ? null : (
              <FieldDescription className="mt-2 text-destructive">{error}</FieldDescription>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button className="pressable mt-5 w-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Continue with email"}
                </Button>
              )}
            </form.Subscribe>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div className="wizard-step w-full text-center">
            <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheckIcon className="size-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We sent a secure signup link to {sent.email}.
            </p>
            {sent.demoLink === undefined ? null : (
              <Button asChild className="pressable mt-5">
                <a href={sent.demoLink}>Open demo magic link</a>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
