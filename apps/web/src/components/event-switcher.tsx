import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { BrandMark } from "@/components/app/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function EventSwitcher({
  event,
}: {
  readonly event: { readonly name: string; readonly dates: string };
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <BrandMark />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{event.name}</span>
                <span className="truncate text-xs text-muted-foreground">{event.dates}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Events</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 p-2">
              <BrandMark className="size-6 rounded-md" />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{event.name}</span>
                <span className="truncate text-xs text-muted-foreground">{event.dates}</span>
              </div>
              <CheckIcon className="size-4 text-primary" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
