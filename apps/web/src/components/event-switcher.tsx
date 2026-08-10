import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { BrandMark } from "@/components/app/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            <BrandMark />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{event.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">{event.dates}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Events
              </DropdownMenuLabel>
              <DropdownMenuItem className="gap-2 p-2">
                <BrandMark className="size-6 rounded-md text-[10px]" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{event.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{event.dates}</span>
                </div>
                <CheckIcon className="size-4 text-primary" />
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
