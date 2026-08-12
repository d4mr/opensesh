import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestMagicLink } from "@/server-fns/auth";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const [error, setError] = useState<string>();
  const [panelFailed, setPanelFailed] = useState(false);
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
    <SignupBackdrop>
      <div className="w-full max-w-sm md:max-w-3xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid min-h-[28rem] p-0 md:grid-cols-2">
            <div className="flex items-center p-6 md:p-8">
              {sent === undefined ? (
                <form
                  className="wizard-step w-full"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <BrandMark className="mb-1" />
                    <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
                    <p className="text-balance text-sm text-muted-foreground">
                      Start with your work email. No password required.
                    </p>
                  </div>
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
                    <Link
                      to="/login"
                      search={{ demo: undefined, email: undefined }}
                      className="font-medium text-foreground hover:underline"
                    >
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
            <div className="relative hidden bg-primary/10 md:block">
              {panelFailed ? null : (
                <img
                  src="/art/garden-congress.webp"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover dark:brightness-90"
                  onError={() => setPanelFailed(true)}
                  ref={(element) => {
                    if (element?.complete === true && element.naturalWidth === 0) {
                      setPanelFailed(true);
                    }
                  }}
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-8 pt-16">
                <p className="text-lg font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
                  Build the program together.
                </p>
                <p className="text-sm text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                  Events, speakers, reviews, and schedules in one shared workspace.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SignupBackdrop>
  );
}

function SignupBackdrop({ children }: { readonly children: React.ReactNode }) {
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
