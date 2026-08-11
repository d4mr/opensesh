import type {
  OrganizationMemberView,
  OrganizationRole,
  OrganizationSettings,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { organizationSettingsQuery } from "@/lib/organization-queries";
import {
  getOrganizationSettings,
  removeOrganizationMember,
  revokeOrganizationInvitation,
  updateOrganizationMemberRole,
  updateOrganizationProfile,
} from "@/server-fns/organization";

type OrganizationSettingsResult = Awaited<ReturnType<typeof getOrganizationSettings>>;

export const Route = createFileRoute("/admin/settings/organization")({
  loader: ({ context }) => context.queryClient.ensureQueryData(organizationSettingsQuery),
  component: OrganizationSettingsPage,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

const roleLabel: Readonly<Record<OrganizationRole, string>> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const isOrganizationRole = (value: string): value is OrganizationRole =>
  value === "owner" || value === "admin" || value === "member";

const restore = (
  queryClient: ReturnType<typeof useQueryClient>,
  previous: OrganizationSettingsResult | undefined,
) => queryClient.setQueryData(organizationSettingsQuery.queryKey, previous);

function OrganizationSettingsPage() {
  const result = useSuspenseQuery(organizationSettingsQuery);
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return <OrganizationSettingsContent settings={result.data.data} />;
}

function OrganizationSettingsContent({ settings }: { readonly settings: OrganizationSettings }) {
  return (
    <main className="flex-1 p-4 pb-14 text-sm lg:p-6 lg:pb-14">
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Organization settings</h1>
        <p className="text-xs text-muted-foreground">
          Organization identity, members, and access roles.
        </p>
      </div>
      <div className="grid max-w-4xl gap-6">
        <ProfileForm settings={settings} />
        <section>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-medium">Members</h2>
              <p className="text-xs text-muted-foreground">
                Owners control the organization. Admins can manage non-owner members.
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {settings.members.length}
            </span>
          </div>
          <div className="divide-y overflow-hidden rounded-lg border">
            {settings.members.map((member) => (
              <MemberRow key={member.id} member={member} settings={settings} />
            ))}
          </div>
        </section>
        {settings.invitations.length === 0 ? null : <Invitations settings={settings} />}
      </div>
    </main>
  );
}

function ProfileForm({ settings }: { readonly settings: OrganizationSettings }) {
  const queryClient = useQueryClient();
  const editable = settings.viewer.role === "owner";
  const form = useForm({
    defaultValues: {
      name: settings.organization.name,
      logo: settings.organization.logo ?? "",
    },
    onSubmit: async ({ value }) => {
      const result = await updateOrganizationProfile({
        data: { name: value.name, logo: value.logo.trim() || null },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      queryClient.setQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
        (current) =>
          current?.ok
            ? { ok: true, data: { ...current.data, organization: result.data } }
            : current,
      );
      toast.success("Organization profile saved");
      await queryClient.invalidateQueries({ queryKey: organizationSettingsQuery.queryKey });
    },
  });

  return (
    <section>
      <div className="mb-2">
        <h2 className="font-medium">Profile</h2>
        <p className="text-xs text-muted-foreground">
          Used across shared event administration surfaces.
        </p>
      </div>
      <form
        className="rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Organization name</FieldLabel>
                <Input
                  id={field.name}
                  className="h-9"
                  required
                  disabled={!editable}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="logo">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Logo URL</FieldLabel>
                <Input
                  id={field.name}
                  className="h-9"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  disabled={!editable}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          {editable ? (
            <Button type="submit" size="sm" className="pressable">
              Save profile
            </Button>
          ) : null}
        </div>
        <FieldDescription className="mt-2">
          Organization slug: {settings.organization.slug}
          {editable ? "" : " · Only an owner can edit this profile."}
        </FieldDescription>
      </form>
    </section>
  );
}

function MemberRow({
  member,
  settings,
}: {
  readonly member: OrganizationMemberView;
  readonly settings: OrganizationSettings;
}) {
  const queryClient = useQueryClient();
  const ownerCount = settings.members.filter((item) => item.role === "owner").length;
  const onlyOwner = member.role === "owner" && ownerCount === 1;
  const viewerRole = settings.viewer.role;
  const disabledReason =
    viewerRole === "member"
      ? "Members have read-only access."
      : viewerRole === "admin" && member.role === "owner"
        ? "Admins cannot manage owners."
        : onlyOwner
          ? "Add another owner before changing or removing this member."
          : null;
  const disabled = disabledReason !== null;
  const availableRoles: ReadonlyArray<OrganizationRole> =
    viewerRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];

  const role = useMutation({
    mutationFn: (nextRole: OrganizationRole) =>
      updateOrganizationMemberRole({ data: { memberId: member.id, role: nextRole } }),
    onMutate: async (nextRole) => {
      await queryClient.cancelQueries({ queryKey: organizationSettingsQuery.queryKey });
      const previous = queryClient.getQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
      );
      queryClient.setQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
        (current) =>
          current?.ok
            ? {
                ok: true,
                data: {
                  ...current.data,
                  members: current.data.members.map((item) =>
                    item.id === member.id ? { ...item, role: nextRole } : item,
                  ),
                },
              }
            : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error("Could not change the member role");
    },
    onSuccess: (result, _variables, context) => {
      if (result.ok) return;
      restore(queryClient, context?.previous);
      toast.error(result.error.message);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({ queryKey: organizationSettingsQuery.queryKey }),
  });

  const remove = useMutation({
    mutationFn: () => removeOrganizationMember({ data: { memberId: member.id } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: organizationSettingsQuery.queryKey });
      const previous = queryClient.getQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
      );
      queryClient.setQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
        (current) =>
          current?.ok
            ? {
                ok: true,
                data: {
                  ...current.data,
                  members: current.data.members.filter((item) => item.id !== member.id),
                },
              }
            : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error("Could not remove the member");
    },
    onSuccess: (result, _variables, context) => {
      if (result.ok) return;
      restore(queryClient, context?.previous);
      toast.error(result.error.message);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({ queryKey: organizationSettingsQuery.queryKey }),
  });

  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">
      <Avatar className="size-8">
        {member.image === null ? null : <AvatarImage src={member.image} alt="" />}
        <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.name}
          {member.userId === settings.viewer.userId ? (
            <span className="ml-1.5 font-normal text-muted-foreground">You</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        {onlyOwner ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add another owner before changing this role.
          </p>
        ) : null}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Select
              value={member.role}
              disabled={disabled || role.isPending}
              onValueChange={(value) => isOrganizationRole(value) && role.mutate(value)}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Role for ${member.name}`}
                className="w-28 capitalize"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabel[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </TooltipTrigger>
        {disabledReason === null ? null : <TooltipContent>{disabledReason}</TooltipContent>}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="pressable text-muted-foreground"
              aria-label={`Remove ${member.name}`}
              disabled={disabled || remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2Icon />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason ?? `Remove ${member.name}`}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Invitations({ settings }: { readonly settings: OrganizationSettings }) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="font-medium">Pending invitations</h2>
        <p className="text-xs text-muted-foreground">
          Invitations disappear after they are accepted, canceled, or expire.
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">
        {settings.invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} settings={settings} />
        ))}
      </div>
    </section>
  );
}

function InvitationRow({
  invitation,
  settings,
}: {
  readonly invitation: OrganizationSettings["invitations"][number];
  readonly settings: OrganizationSettings;
}) {
  const queryClient = useQueryClient();
  const disabled =
    settings.viewer.role === "member" ||
    (settings.viewer.role === "admin" && invitation.role === "owner");
  const revoke = useMutation({
    mutationFn: () => revokeOrganizationInvitation({ data: { invitationId: invitation.id } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: organizationSettingsQuery.queryKey });
      const previous = queryClient.getQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
      );
      queryClient.setQueryData<OrganizationSettingsResult>(
        organizationSettingsQuery.queryKey,
        (current) =>
          current?.ok
            ? {
                ok: true,
                data: {
                  ...current.data,
                  invitations: current.data.invitations.filter((item) => item.id !== invitation.id),
                },
              }
            : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error("Could not revoke the invitation");
    },
    onSuccess: (result, _variables, context) => {
      if (result.ok) return;
      restore(queryClient, context?.previous);
      toast.error(result.error.message);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({ queryKey: organizationSettingsQuery.queryKey }),
  });

  return (
    <div className="flex min-h-12 items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          Expires{" "}
          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(invitation.expiresAt)}
        </p>
      </div>
      <Badge variant="outline">{roleLabel[invitation.role]}</Badge>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="pressable text-muted-foreground"
        aria-label={`Revoke invitation for ${invitation.email}`}
        disabled={disabled || revoke.isPending}
        onClick={() => revoke.mutate()}
      >
        <XIcon />
      </Button>
    </div>
  );
}
