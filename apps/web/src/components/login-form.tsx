import { useForm } from "@tanstack/react-form";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { requestMagicLink } from "@/server-fns/auth";

export function LoginForm({
  eventName,
  eventDates,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  readonly eventName: string;
  readonly eventDates: string;
}) {
  const [error, setError] = useState<string>();
  const [magicSending, setMagicSending] = useState(false);
  const [panelFailed, setPanelFailed] = useState(false);
  const [sent, setSent] = useState<{ readonly email: string; readonly demoLink?: string }>();
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL: "/",
      });
      if (result.error !== null) {
        setError(result.error.message ?? "Could not sign in");
        return;
      }
      window.location.assign("/");
    },
  });

  const sendMagicLink = async () => {
    const email = form.state.values.email;
    if (email.length === 0) {
      setError("Enter your email first");
      return;
    }
    setError(undefined);
    setMagicSending(true);
    const result = await requestMagicLink({ data: { email } });
    setMagicSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent({
      email,
      ...(result.data.demoLink === undefined ? {} : { demoLink: result.data.demoLink }),
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              submitEvent.stopPropagation();
              void form.handleSubmit();
            }}
          >
            {sent === undefined ? (
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <BrandMark className="mb-1" />
                  <h1 className="text-lg font-semibold">{eventName}</h1>
                  <p className="text-sm text-balance text-muted-foreground">
                    Sign in to manage your program or speaker tasks.
                  </p>
                </div>
                <form.Field name="email">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="password">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        autoComplete="current-password"
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                      />
                    </Field>
                  )}
                </form.Field>
                {error === undefined ? null : (
                  <FieldDescription className="text-destructive">{error}</FieldDescription>
                )}
                <Field>
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button type="submit" disabled={!canSubmit || magicSending}>
                        {isSubmitting ? "Signing in…" : "Sign in"}
                      </Button>
                    )}
                  </form.Subscribe>
                </Field>
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  Or
                </FieldSeparator>
                <Field>
                  <Button
                    variant="link"
                    type="button"
                    className="w-full"
                    disabled={magicSending}
                    onClick={() => void sendMagicLink()}
                  >
                    {magicSending ? "Sending…" : "Email me a magic link"}
                  </Button>
                </Field>
              </FieldGroup>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <MailCheckIcon className="size-8 text-primary" />
                <h1 className="mt-4 text-lg font-semibold">Check your email</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a sign-in link to {sent.email}.
                </p>
                {sent.demoLink === undefined ? null : (
                  <Button className="mt-5" render={<a href={sent.demoLink} />}>
                    Open demo magic link
                  </Button>
                )}
              </div>
            )}
          </form>
          <div className="relative hidden min-h-[32rem] overflow-hidden bg-primary/12 md:block">
            {panelFailed ? null : (
              <img
                src="/brand/login-panel.jpg"
                alt=""
                className="absolute inset-0 size-full object-cover opacity-35 mix-blend-multiply dark:mix-blend-luminosity"
                onError={() => setPanelFailed(true)}
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-primary/30 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-8">
              <p className="text-lg font-semibold text-foreground">{eventName}</p>
              <p className="mt-1 text-sm text-foreground/70">{eventDates}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
