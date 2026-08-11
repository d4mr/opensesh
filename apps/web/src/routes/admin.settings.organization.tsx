import type {
  OrganizationMemberView,
  OrganizationRole,
  OrganizationSettings,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImageUpIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EventIcon } from "@/components/app/event-icon";
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
import { fileAsBase64 } from "@/lib/files";
import { organizationSettingsQuery } from "@/lib/organization-queries";
import { cn } from "@/lib/utils";
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

function SettingsSection({
  title,
  meta,
  className,
  children,
}: {
  readonly title: string;
  readonly meta?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-9 items-center justify-between gap-3 border-b bg-muted/30 px-3">
        <h2 className="text-xs font-medium">{title}</h2>
        {meta === undefined ? null : (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        )}
      </div>
      <div className={className ?? "p-4"}>{children}</div>
    </section>
  );
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
      <div className="grid max-w-4xl gap-3">
        <ProfileForm settings={settings} />
        <SettingsSection
          title="Members"
          meta={`${settings.members.length} · Owners control the organization; admins manage non-owner members`}
          className="divide-y"
        >
          {settings.members.map((member) => (
            <MemberRow key={member.id} member={member} settings={settings} />
          ))}
        </SettingsSection>
        {settings.invitations.length === 0 ? null : <Invitations settings={settings} />}
      </div>
    </main>
  );
}

function ProfileForm({ settings }: { readonly settings: OrganizationSettings }) {
  const queryClient = useQueryClient();
  const editable = settings.viewer.role === "owner";
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(settings.organization.logo);

  useEffect(() => {
    if (logoFile === null) {
      setPreviewUrl(settings.organization.logo);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [settings.organization.logo, logoFile]);

  const chooseLogo = (file: File | undefined) => {
    if (file === undefined || !editable) return;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast.error("Use a PNG, JPG, or SVG organization logo");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Organization logos must be 2 MB or smaller");
      return;
    }
    setLogoFile(file);
  };

  const form = useForm({
    defaultValues: {
      name: settings.organization.name,
      logo: settings.organization.logo ?? "",
    },
    onSubmit: async ({ value }) => {
      const logoUpload =
        logoFile === null
          ? null
          : {
              filename: logoFile.name,
              contentType: logoFile.type,
              size: logoFile.size,
              base64: await fileAsBase64(logoFile),
            };
      const result = await updateOrganizationProfile({
        data: { name: value.name, logo: value.logo.trim() || null, logoUpload },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setLogoFile(null);
      form.setFieldValue("logo", result.data.logo ?? "");
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SettingsSection
        title="Profile"
        meta={editable ? "Used across shared event administration surfaces" : "Owner-only editing"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field>
            <FieldLabel htmlFor="organization-slug">Slug</FieldLabel>
            <Input
              id="organization-slug"
              className="h-9 font-mono text-xs"
              readOnly
              value={settings.organization.slug}
            />
          </Field>
          <div className="grid content-start gap-4">
            <Field>
              <FieldLabel>Organization logo</FieldLabel>
              <label
                className={cn(
                  "pressable flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors",
                  dragging && "border-primary bg-primary/5",
                  !editable && "pointer-events-none opacity-60",
                )}
                onDragEnter={(dragEvent) => {
                  dragEvent.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(dragEvent) => dragEvent.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(dragEvent) => {
                  dragEvent.preventDefault();
                  setDragging(false);
                  chooseLogo(dragEvent.dataTransfer.files[0]);
                }}
              >
                <ImageUpIcon className="mb-2 size-5 text-muted-foreground" />
                <span className="text-xs font-medium">Drop a logo or click to browse</span>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  PNG, JPG, or SVG · 2 MB max
                </span>
                <input
                  type="file"
                  className="sr-only"
                  disabled={!editable}
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(inputEvent) => chooseLogo(inputEvent.target.files?.[0])}
                />
              </label>
              {logoFile === null ? null : <FieldDescription>{logoFile.name}</FieldDescription>}
            </Field>
            <form.Field name="logo">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Remote logo URL</FieldLabel>
                  <Input
                    id={field.name}
                    className="h-9"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    disabled={!editable}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      if (logoFile === null) setPreviewUrl(event.target.value || null);
                    }}
                  />
                  <FieldDescription>Used when no uploaded logo is selected.</FieldDescription>
                </Field>
              )}
            </form.Field>
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="flex h-9 items-center border-b bg-muted/30 px-3 text-xs font-medium">
              True-size previews
            </div>
            <div className="divide-y">
              <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Sidebar switcher</span>
                <EventIcon src={previewUrl} size={32} />
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Org context header</span>
                <EventIcon src={previewUrl} size={24} />
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Favicon</span>
                <EventIcon src={previewUrl} size={16} />
              </div>
            </div>
          </div>
        </div>
        {editable ? (
          <div className="mt-4 flex justify-end border-t pt-3">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" size="sm" className="pressable" disabled={submitting}>
                  {submitting ? "Saving…" : "Save profile"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        ) : (
          <FieldDescription className="mt-3">Only an owner can edit this profile.</FieldDescription>
        )}
      </SettingsSection>
    </form>
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
    <SettingsSection
      title="Pending invitations"
      meta="Invitations disappear after they are accepted, canceled, or expire"
      className="divide-y"
    >
      {settings.invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} settings={settings} />
      ))}
    </SettingsSection>
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
