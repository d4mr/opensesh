import { useForm } from "@tanstack/react-form";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2Icon, CircleAlertIcon, MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestMagicLink } from "@/server-fns/auth";
import { acceptOrganizationInvitation, getOrganizationInvitation } from "@/server-fns/organization";

const invitationQuery = (invitationId: string) =>
  queryOptions({
    queryKey: ["organization-invitation", invitationId],
    queryFn: () => getOrganizationInvitation({ data: { invitationId } }),
    retry: false,
  });

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { invitationId } = Route.useParams();
  const invitation = useQuery(invitationQuery(invitationId));

  return (
    <main className="min-h-svh bg-background">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <BrandMark className="size-6" />
        <span className="text-sm font-semibold tracking-tight">opensesh</span>
      </header>
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-sm items-center px-5 py-12">
        {invitation.data === undefined ? (
          <p className="w-full text-center text-sm text-muted-foreground">Loading invitation…</p>
        ) : invitation.data.ok ? (
          <InvitationDetails invitation={invitation.data.data} invitationId={invitationId} />
        ) : invitation.data.error.status === 401 ? (
          <InvitationSignIn invitationId={invitationId} />
        ) : (
          <div className="wizard-step w-full text-center">
            <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlertIcon className="size-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Invitation unavailable</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{invitation.data.error.message}</p>
            <Button asChild variant="outline" className="pressable mt-5">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function InvitationDetails({
  invitation,
  invitationId,
}: {
  readonly invitation: {
    readonly organizationName: string;
    readonly inviterEmail: string;
    readonly role: string;
  };
  readonly invitationId: string;
}) {
  const [error, setError] = useState<string>();
  const [accepting, setAccepting] = useState(false);
  const accept = async () => {
    setAccepting(true);
    setError(undefined);
    const result = await acceptOrganizationInvitation({ data: { invitationId } });
    if (!result.ok) {
      setAccepting(false);
      setError(result.error.message);
      return;
    }
    window.location.assign("/admin");
  };
  return (
    <div className="wizard-step w-full text-center">
      <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2Icon className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Join {invitation.organizationName}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {invitation.inviterEmail} invited you as{" "}
        {invitation.role === "admin" ? "an admin" : "a member"}.
      </p>
      {error === undefined ? null : <p className="mt-3 text-xs text-destructive">{error}</p>}
      <Button className="pressable mt-5" disabled={accepting} onClick={() => void accept()}>
        {accepting ? "Joining…" : "Accept invitation"}
      </Button>
    </div>
  );
}

function InvitationSignIn({ invitationId }: { readonly invitationId: string }) {
  const [sent, setSent] = useState<{ readonly email: string; readonly demoLink?: string }>();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const callbackUrl = `/accept-invitation/${invitationId}`;
      const result = await requestMagicLink({ data: { email: value.email, callbackUrl } });
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
  if (sent !== undefined) {
    return (
      <div className="wizard-step w-full text-center">
        <span className="wizard-pop mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in as {sent.email} to continue.</p>
        {sent.demoLink === undefined ? null : (
          <Button asChild className="pressable mt-5">
            <a href={sent.demoLink}>Open demo magic link</a>
          </Button>
        )}
      </div>
    );
  }
  return (
    <form
      className="wizard-step w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h1 className="text-xl font-semibold tracking-tight">Sign in to accept</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Use the email address this invitation was sent to.
      </p>
      <form.Field name="email">
        {(field) => (
          <Field className="mt-6">
            <FieldLabel htmlFor={field.name}>Email</FieldLabel>
            <Input
              id={field.name}
              type="email"
              required
              autoFocus
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
            {submitting ? "Sending…" : "Email me a sign-in link"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
