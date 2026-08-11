import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import { useState } from "react";

import { OrgSettingsDialog } from "@/components/organization/org-settings-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function OrgLogo({
  logo,
  className,
}: {
  readonly logo: string | null;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background",
        className,
      )}
    >
      {logo === null ? (
        <Building2Icon className="size-4" />
      ) : (
        <img src={logo} alt="" className="size-full object-cover" />
      )}
    </span>
  );
}

export function OrgSwitcher({ user }: { readonly user: CurrentUserValue }) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const organizations = authClient.useListOrganizations();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const list = organizations.data ?? [];
  const active = list.find((organization) => organization.id === user.orgId);

  const switchOrganization = async (organizationId: string) => {
    if (organizationId === user.orgId) return;
    await authClient.organization.setActive({ organizationId });
    window.location.assign("/admin");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <OrgLogo logo={active?.logo ?? null} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active?.name ?? "Organization"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {active?.slug ?? "Workspace"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {list.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                className="text-[13px]"
                onClick={() => void switchOrganization(organization.id)}
              >
                <OrgLogo logo={organization.logo ?? null} className="size-5 rounded-sm" />
                <span className="truncate">{organization.name}</span>
                {organization.id === user.orgId ? <CheckIcon className="ml-auto size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {user.roles.member ? (
              <DropdownMenuItem
                className="text-[13px] text-muted-foreground"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2Icon />
                Organization settings
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="text-[13px] text-muted-foreground"
              onClick={() => void navigate({ to: "/onboarding", search: { new: 1 } })}
            >
              <PlusIcon />
              Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <OrgSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
