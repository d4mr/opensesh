import { Link } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function NavItemLink({ item }: { readonly item: AdminNavItem }) {
  const content = (
    <>
      {item.icon}
      <span>{item.title}</span>
    </>
  );
  if (item.section === undefined) return <Link to="/admin">{content}</Link>;
  if (item.section === "abstracts")
    return (
      <Link to="/admin/abstracts" search={{ status: "all" }}>
        {content}
      </Link>
    );
  if (item.section === "sessions")
    return (
      <Link to="/admin/sessions" search={{ status: "all" }}>
        {content}
      </Link>
    );
  if (item.section === "forms") return <Link to="/admin/forms">{content}</Link>;
  if (item.section === "evaluation") return <Link to="/admin/evaluation">{content}</Link>;
  return (
    <Link to="/admin/$section" params={{ section: item.section }}>
      {content}
    </Link>
  );
}

export interface AdminNavItem {
  readonly title: string;
  readonly section?: string;
  readonly icon: React.ReactNode;
  readonly badge?: number;
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
                : pathname === `/admin/${item.section}` ||
                  pathname.startsWith(`/admin/${item.section}/`);

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <NavItemLink item={item} />
                </SidebarMenuButton>
                {item.badge === undefined || item.badge === 0 ? null : (
                  <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
