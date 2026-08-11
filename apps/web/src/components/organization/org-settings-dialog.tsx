import type {
  OrganizationMemberView,
  OrganizationRole,
  OrganizationSettings,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Building2Icon,
  ImageUpIcon,
  MailPlusIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { EventIcon } from "@/components/app/event-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Organization settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your organization profile, members, and invitations.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {nav.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
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
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink
                        className="cursor-pointer"
                        onClick={() => setSection("Profile")}
                      >
                        Organization settings
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{section}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0 text-sm">
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
    <div className="space-y-3">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-28 w-full" />
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
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="org-dialog-name">Organization name</FieldLabel>
              <Input
                id="org-dialog-name"
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
          <FieldLabel htmlFor="org-dialog-slug">Slug</FieldLabel>
          <Input
            id="org-dialog-slug"
            className="h-9 font-mono text-xs"
            readOnly
            value={settings.organization.slug}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="grid content-start gap-4">
          <Field>
            <FieldLabel>Organization logo</FieldLabel>
            <label
              className={cn(
                "pressable flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors",
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
              <ImageUpIcon className="mb-1.5 size-5 text-muted-foreground" />
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
                <FieldLabel htmlFor="org-dialog-logo-url">Remote logo URL</FieldLabel>
                <Input
                  id="org-dialog-logo-url"
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
        <div className="h-fit overflow-hidden rounded-md border">
          <div className="flex h-8 items-center border-b bg-muted/30 px-3 text-[11px] font-medium">
            True-size previews
          </div>
          <div className="divide-y">
            <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Org switcher</span>
              <EventIcon src={previewUrl} size={32} />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Context header</span>
              <EventIcon src={previewUrl} size={24} />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Favicon</span>
              <EventIcon src={previewUrl} size={16} />
            </div>
          </div>
        </div>
      </div>
      {editable ? (
        <div className="flex justify-end border-t pt-3">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type="submit" size="sm" className="pressable" disabled={submitting}>
                {submitting ? "Saving…" : "Save profile"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      ) : (
        <FieldDescription>Only an owner can edit this profile.</FieldDescription>
      )}
    </form>
  );
}

function MembersSection({ settings }: { readonly settings: OrganizationSettings }) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {settings.members.length} {settings.members.length === 1 ? "member" : "members"} · Owners
        control the organization; admins manage non-owner members.
      </p>
      <div className="divide-y overflow-hidden rounded-lg border">
        {settings.members.map((member) => (
          <MemberRow key={member.id} member={member} settings={settings} />
        ))}
      </div>
    </div>
  );
}

function InvitationsSection({ settings }: { readonly settings: OrganizationSettings }) {
  if (settings.invitations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <MailPlusIcon className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">No pending invitations</p>
        <p className="text-xs text-muted-foreground">
          Invitations disappear after they are accepted, canceled, or expire.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Invitations disappear after they are accepted, canceled, or expire.
      </p>
      <div className="divide-y overflow-hidden rounded-lg border">
        {settings.invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} settings={settings} />
        ))}
      </div>
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
    <div className="flex min-h-13 items-center gap-3 px-3 py-2">
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
                className="w-26 capitalize"
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
    <div className="flex min-h-12 items-center gap-3 px-3 py-2">
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
