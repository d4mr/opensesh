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

// Must forward props: SidebarMenuButton asChild injects its styling className
// (and data attributes) through Radix Slot — dropping them unstyles the row.
function NavItemLink({
  item,
  ...props
}: { readonly item: AdminNavItem } & Omit<React.ComponentPropsWithoutRef<"a">, "href">) {
  const content = (
    <>
      {item.icon}
      <span>{item.title}</span>
    </>
  );
  if (item.section === undefined)
    return (
      <Link to="/admin" {...props}>
        {content}
      </Link>
    );
  if (item.section === "abstracts")
    return (
      <Link to="/admin/abstracts" search={{ status: "all", spotlight: undefined }} {...props}>
        {content}
      </Link>
    );
  if (item.section === "sessions")
    return (
      <Link to="/admin/sessions" search={{ status: "all", spotlight: undefined }} {...props}>
        {content}
      </Link>
    );
  if (item.section === "forms")
    return (
      <Link to="/admin/forms" {...props}>
        {content}
      </Link>
    );
  if (item.section === "evaluation")
    return (
      <Link to="/admin/evaluation" {...props}>
        {content}
      </Link>
    );
  if (item.section === "agenda")
    return (
      <Link
        to="/admin/agenda"
        search={{ view: "rooms", day: undefined, draft: undefined }}
        {...props}
      >
        {content}
      </Link>
    );
  if (item.section === "emails")
    return (
      <Link to="/admin/emails" {...props}>
        {content}
      </Link>
    );
  if (item.section === "communications")
    return (
      <Link to="/admin/communications" {...props}>
        {content}
      </Link>
    );
  if (item.section === "speakers")
    return (
      <Link to="/admin/speakers" search={{ spotlight: undefined }} {...props}>
        {content}
      </Link>
    );
  if (item.section === "widgets")
    return (
      <Link to="/admin/widgets" search={{ widget: undefined }} {...props}>
        {content}
      </Link>
    );
  return (
    <Link
      to="/admin/$section"
      params={{ section: item.section }}
      search={{ spotlight: undefined }}
      {...props}
    >
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
