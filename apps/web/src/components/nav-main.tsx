import { Link } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface AdminNavItem {
  readonly title: string;
  readonly section?: string;
  readonly icon: React.ReactNode;
}

export function NavMain({
  label,
  items,
  pathname,
}: {
  readonly label?: string;
  readonly items: ReadonlyArray<AdminNavItem>;
  readonly pathname: string;
}) {
  return (
    <SidebarGroup>
      {label === undefined ? null : <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              item.section === undefined
                ? pathname === "/admin"
                : pathname === `/admin/${item.section}`;

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  {item.section === undefined ? (
                    <Link to="/admin">
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  ) : (
                    <Link to="/admin/$section" params={{ section: item.section }}>
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
