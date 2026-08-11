import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Building2Icon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { CreateEventForm } from "@/components/events/create-event-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAdminBootstrap } from "@/server-fns/admin";
import {
  createOrganization,
  getOnboardingState,
  inviteOrganizationMember,
} from "@/server-fns/organization";

const onboardingQuery = {
  queryKey: ["onboarding-state"],
  queryFn: () => getOnboardingState(),
  staleTime: 0,
} as const;

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    new:
      search.new === true || search.new === 1 || search.new === "1" || search.new === "true"
        ? 1
        : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    const state = await context.queryClient.ensureQueryData(onboardingQuery);
    if (!state.ok) throw redirect({ to: state.error.status === 401 ? "/signup" : "/login" });
    if (search.new) return { existingOrganization: undefined };
    const events = await getAdminBootstrap();
    if (state.data.organizations.length > 0) {
      if (events.ok && events.data.length > 0) throw redirect({ to: "/admin" });
    }
    if (!events.ok && events.error.status === 403) throw redirect({ to: "/portal" });
    return { existingOrganization: state.data.organizations[0] };
  },
  component: Onboarding,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const fileUpload = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    filename: file.name,
    contentType: file.type,
    size: file.size,
    base64: btoa(binary),
  };
};

function Onboarding() {
  const { existingOrganization } = Route.useRouteContext();
  const [step, setStep] = useState(existingOrganization === undefined ? 0 : 1);
  const [organizationName, setOrganizationName] = useState(existingOrganization?.name ?? "");
  const [inviteRows, setInviteRows] = useState([crypto.randomUUID()]);
  const [demoLinks, setDemoLinks] = useState<ReadonlyArray<string>>([]);
  const labels = ["Organization", "Invite team", "First event"];

  return (
    <main className="min-h-svh bg-background">
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <BrandMark className="size-6" />
        <span className="text-sm font-semibold tracking-tight">opensesh</span>
        <span className="text-xs text-muted-foreground">Workspace setup</span>
      </header>
      <div className="mx-auto max-w-xl px-5 py-10 sm:py-14">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {step + 1} of 3 · {labels[step]}
            </span>
            <span>{organizationName || "New workspace"}</span>
          </div>
          <div className="flex gap-1">
            {labels.map((label, index) => (
              <span
                key={label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
        <div key={step} className="wizard-step">
          {step === 0 ? (
            <OrganizationStep
              onCreated={(name) => {
                setOrganizationName(name);
                setStep(1);
              }}
            />
          ) : step === 1 ? (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Invite your team</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Add the people who will help run {organizationName}.
              </p>
              <div className="mt-6 overflow-hidden rounded-lg border divide-y">
                {inviteRows.map((id) => (
                  <InviteRow
                    key={id}
                    onRemove={
                      inviteRows.length === 1
                        ? undefined
                        : () => setInviteRows((rows) => rows.filter((row) => row !== id))
                    }
                    onDemoLink={(url) => setDemoLinks((links) => [...links, url])}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="pressable mt-2 text-muted-foreground"
                onClick={() => setInviteRows((rows) => [...rows, crypto.randomUUID()])}
              >
                <PlusIcon /> Add another
              </Button>
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Skip for now
                  </Button>
                  <Button className="pressable" onClick={() => setStep(2)}>
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Create your first event</h1>
              <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
                Set the dates and timezone. You can add program details next.
              </p>
              {demoLinks.length === 0 ? null : (
                <p className="mb-5 text-xs text-muted-foreground">
                  Demo invitation{demoLinks.length === 1 ? "" : "s"}:{" "}
                  {demoLinks.map((url, index) => (
                    <span key={url}>
                      {index === 0 ? "" : " · "}
                      <a className="font-medium text-foreground hover:underline" href={url}>
                        Open invite {index + 1}
                      </a>
                    </span>
                  ))}
                </p>
              )}
              <CreateEventForm
                submitLabel="Finish setup"
                onCreated={async () => window.location.assign("/admin")}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function OrganizationStep({ onCreated }: { readonly onCreated: (name: string) => void }) {
  const [logo, setLogo] = useState<File>();
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { name: "", slug: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await createOrganization({
        data: {
          name: value.name,
          slug: value.slug,
          logoUpload: logo === undefined ? null : await fileUpload(logo),
        },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCreated(result.data.name);
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2Icon className="size-4" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">Create your organization</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This is the workspace your events and teammates belong to.
      </p>
      <div className="wizard-fields mt-6 space-y-4">
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Organization name</FieldLabel>
              <Input
                id={field.name}
                autoFocus
                required
                placeholder="Acme Events"
                value={field.state.value}
                onChange={(event) => {
                  const name = event.target.value;
                  field.handleChange(name);
                  form.setFieldValue("slug", slugify(name));
                }}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="slug">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Workspace URL</FieldLabel>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50">
                <span>opensesh.io/</span>
                <input
                  id={field.name}
                  required
                  className="min-w-0 flex-1 bg-transparent px-0.5 pr-3 text-foreground outline-none"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(slugify(event.target.value))}
                />
              </div>
            </Field>
          )}
        </form.Field>
        <Field>
          <FieldLabel htmlFor="organization-logo">Logo · optional</FieldLabel>
          <Input
            id="organization-logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(event) => setLogo(event.target.files?.[0])}
          />
          <FieldDescription>PNG, JPG, or SVG up to 2 MB.</FieldDescription>
        </Field>
      </div>
      {error === undefined ? null : (
        <FieldDescription className="mt-3 text-destructive">{error}</FieldDescription>
      )}
      <div className="mt-6 flex justify-end border-t pt-4">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button className="pressable" disabled={submitting}>
              {submitting ? "Creating…" : "Create organization"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

function InviteRow({
  onRemove,
  onDemoLink,
}: {
  readonly onRemove?: () => void;
  readonly onDemoLink: (url: string) => void;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { email: "", role: "member" as "admin" | "member" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await inviteOrganizationMember({ data: value });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.demoLink !== undefined) onDemoLink(result.data.demoLink);
      setSent(true);
    },
  });
  return (
    <form
      className="p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-end gap-2">
        <form.Field name="email">
          {(field) => (
            <Field className="min-w-0 flex-1">
              <FieldLabel className="sr-only">Email</FieldLabel>
              <Input
                type="email"
                required
                disabled={sent}
                placeholder="teammate@company.com"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <Field className="w-32">
              <FieldLabel className="sr-only">Role</FieldLabel>
              <Select
                disabled={sent}
                value={field.state.value}
                onValueChange={(value) => {
                  if (value === "admin" || value === "member") field.handleChange(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member" textValue="Member">
                    <span className="flex flex-col items-start">
                      <span>Member</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Sees events and assigned reviews.
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value="admin" textValue="Admin">
                    <span className="flex flex-col items-start">
                      <span>Admin</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Runs events, speakers, and reviews.
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        {sent ? (
          <span className="flex h-9 items-center px-2 text-xs font-medium text-primary">Sent</span>
        ) : (
          <Button className="pressable" type="submit" size="icon" aria-label="Send invitation">
            <SendIcon />
          </Button>
        )}
        {onRemove === undefined || sent ? null : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remove row"
            onClick={onRemove}
          >
            <XIcon />
          </Button>
        )}
      </div>
      {error === undefined ? null : (
        <FieldDescription className="mt-1 text-destructive">{error}</FieldDescription>
      )}
    </form>
  );
}
