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
      {label === undefined ? null : (
        <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              item.section === undefined
                ? pathname === "/admin"
                : pathname === `/admin/${item.section}`;
            const link =
              item.section === undefined ? (
                <Link to="/admin" />
              ) : (
                <Link to="/admin/$section" params={{ section: item.section }} />
              );

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton render={link} isActive={active} tooltip={item.title}>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
