import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import type { AdminNavItem } from "@/components/nav-main";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  item,
  pathname,
  ...props
}: {
  readonly item: AdminNavItem & { readonly section: string };
  readonly pathname: string;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible
            asChild
            defaultOpen={
              pathname.startsWith("/admin/settings") && pathname !== "/admin/settings/organization"
            }
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={
                    pathname.startsWith("/admin/settings") &&
                    pathname !== "/admin/settings/organization"
                  }
                  tooltip={item.title}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  <ChevronRightIcon className="ml-auto transition-transform duration-200 [transition-timing-function:var(--ease-in-out)] group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === "/admin/settings/event"}>
                      <Link to="/admin/settings/event">Event</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === "/admin/settings/library"}>
                      <Link to="/admin/settings/library">Library</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
