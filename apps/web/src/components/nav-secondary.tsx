import { Link } from "@tanstack/react-router";

import type { AdminNavItem } from "@/components/nav-main";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/admin/$section" params={{ section: item.section }} />}
              isActive={pathname === `/admin/${item.section}`}
              tooltip={item.title}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
