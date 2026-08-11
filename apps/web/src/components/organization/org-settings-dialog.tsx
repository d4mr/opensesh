import type {
  OrganizationMemberView,
  OrganizationRole,
  OrganizationSettings,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Building2Icon, MailPlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
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

type SectionName = "Profile" | "Members" | "Invitations";

const nav: ReadonlyArray<{ readonly name: SectionName; readonly icon: typeof Building2Icon }> = [
  { name: "Profile", icon: Building2Icon },
  { name: "Members", icon: UsersIcon },
  { name: "Invitations", icon: MailPlusIcon },
];

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

export function OrgSettingsDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<SectionName>("Profile");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSection("Profile");
        onOpenChange(next);
      }}
    >
      <DialogContent className="overflow-hidden p-0 md:max-h-[620px] md:max-w-[820px] lg:max-w-[960px]">
        <DialogTitle className="sr-only">Organization settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your organization profile, members, and invitations.
        </DialogDescription>
        <SidebarProvider
          className="items-start"
          style={{ "--sidebar-width": "11rem" } as React.CSSProperties}
        >
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Organization</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          size="sm"
                          className="text-[13px]"
                          isActive={item.name === section}
                          onClick={() => setSection(item.name)}
                        >
                          <item.icon />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[600px] flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8 text-sm">
              {open ? (
                <Suspense fallback={<SectionSkeleton />}>
                  <SectionContent section={section} />
                </Suspense>
              ) : null}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

function SectionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <header className="mb-2 border-b pb-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
    </header>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint === undefined ? null : <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

function SectionContent({ section }: { readonly section: SectionName }) {
  const result = useSuspenseQuery(organizationSettingsQuery);
  if (!result.data.ok) {
    return <p className="text-sm text-muted-foreground">{result.data.error.message}</p>;
  }
  const settings = result.data.data;
  if (section === "Members") return <MembersSection settings={settings} />;
  if (section === "Invitations") return <InvitationsSection settings={settings} />;
  return <ProfileSection settings={settings} />;
}

function ProfileSection({ settings }: { readonly settings: OrganizationSettings }) {
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
      form.reset({ name: result.data.name, logo: result.data.logo ?? "" });
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
      className="mx-auto w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SectionHeader
        title="Profile"
        description={
          editable
            ? "Your organization's identity across every event."
            : "Your organization's identity across every event. Only an owner can edit it."
        }
      />
      <div className="divide-y">
        <SettingRow label="Logo" hint="PNG, JPG, or SVG · 2 MB max · drop a file on the tile">
          <label
            aria-label="Upload organization logo"
            className={cn(
              "pressable flex size-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/40",
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
            {previewUrl === null ? (
              <Building2Icon className="size-5 text-muted-foreground" />
            ) : (
              <img src={previewUrl} alt="" className="size-full object-cover" />
            )}
            <input
              type="file"
              className="sr-only"
              disabled={!editable}
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(inputEvent) => chooseLogo(inputEvent.target.files?.[0])}
            />
          </label>
        </SettingRow>
        <SettingRow label="Name">
          <form.Field name="name">
            {(field) => (
              <Input
                aria-label="Organization name"
                className="h-8 w-64"
                required
                disabled={!editable}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
        </SettingRow>
        <SettingRow label="Slug" hint="Fixed identifier used in URLs and integrations">
          <span className="font-mono text-xs text-muted-foreground">
            {settings.organization.slug}
          </span>
        </SettingRow>
      </div>
      {editable ? (
        <form.Subscribe selector={(state) => [state.isSubmitting, state.isDirty] as const}>
          {([submitting, dirty]) =>
            dirty || logoFile !== null ? (
              <div className="flex items-center justify-end gap-2 border-t pt-4">
                {logoFile === null ? null : (
                  <span className="truncate text-xs text-muted-foreground">{logoFile.name}</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="pressable"
                  disabled={submitting}
                  onClick={() => {
                    form.reset();
                    setLogoFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="pressable" disabled={submitting}>
                  {submitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            ) : null
          }
        </form.Subscribe>
      ) : null}
    </form>
  );
}

function MembersSection({ settings }: { readonly settings: OrganizationSettings }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <SectionHeader
        title="Members"
        description={`${settings.members.length} ${settings.members.length === 1 ? "person" : "people"} in ${settings.organization.name}. Owners control the organization; admins manage non-owner members.`}
      />
      <div className="divide-y">
        {settings.members.map((member) => (
          <MemberRow key={member.id} member={member} settings={settings} />
        ))}
      </div>
    </div>
  );
}

function InvitationsSection({ settings }: { readonly settings: OrganizationSettings }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <SectionHeader
        title="Invitations"
        description="Pending invitations disappear after they are accepted, canceled, or expire."
      />
      {settings.invitations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <MailPlusIcon className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No pending invitations</p>
          <p className="text-xs text-muted-foreground">
            Invite teammates from the members list to see them here.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {settings.invitations.map((invitation) => (
            <InvitationRow key={invitation.id} invitation={invitation} settings={settings} />
          ))}
        </div>
      )}
    </div>
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
    <div className="group/member flex min-h-12 items-center gap-3 py-2">
      <Avatar className="size-7">
        {member.image === null ? null : <AvatarImage src={member.image} alt="" />}
        <AvatarFallback className="text-[11px]">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name}
          {member.userId === settings.viewer.userId ? (
            <span className="ml-1.5 font-normal text-muted-foreground">You</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
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
                className="h-7 w-fit gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground data-[state=open]:bg-muted/60"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
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
              className="pressable text-muted-foreground opacity-0 group-hover/member:opacity-100 focus-visible:opacity-100"
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
    <div className="group/invitation flex min-h-12 items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          Expires{" "}
          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(invitation.expiresAt)}
        </p>
      </div>
      <Badge variant="outline" className="text-muted-foreground">
        {roleLabel[invitation.role]}
      </Badge>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="pressable text-muted-foreground opacity-0 group-hover/invitation:opacity-100 focus-visible:opacity-100"
        disabled={disabled || revoke.isPending}
        onClick={() => revoke.mutate()}
      >
        Revoke
      </Button>
    </div>
  );
}
