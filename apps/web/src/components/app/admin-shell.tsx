import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileInputIcon,
  FileTextIcon,
  GaugeIcon,
  ListChecksIcon,
  PanelTopIcon,
  SearchIcon,
  SettingsIcon,
  SquareStackIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { UserMenu } from "@/components/app/user-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface NavItem {
  readonly title: string;
  readonly section?: string;
  readonly icon: LucideIcon;
}

const dashboard: ReadonlyArray<NavItem> = [{ title: "Dashboard", icon: GaugeIcon }];
const program: ReadonlyArray<NavItem> = [
  { title: "Abstracts", section: "abstracts", icon: FileTextIcon },
  { title: "Sessions", section: "sessions", icon: SquareStackIcon },
  { title: "Forms", section: "forms", icon: FileInputIcon },
  { title: "Evaluation", section: "evaluation", icon: ClipboardCheckIcon },
  { title: "Agenda", section: "agenda", icon: CalendarDaysIcon },
];
const portals: ReadonlyArray<NavItem> = [
  { title: "Tasks", section: "tasks", icon: CheckSquareIcon },
  { title: "Portal Forms", section: "portal-forms", icon: ListChecksIcon },
  { title: "File Requests", section: "file-requests", icon: PanelTopIcon },
];
const settings: ReadonlyArray<NavItem> = [
  { title: "Settings", section: "settings", icon: SettingsIcon },
];
const allItems = [...dashboard, ...program, ...portals, ...settings];

export function AdminShell({
  eventName,
  user,
}: {
  readonly eventName: string;
  readonly user: CurrentUserValue;
}) {
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const activeTitle =
    allItems.find((item) =>
      item.section === undefined ? pathname === "/admin" : pathname === `/admin/${item.section}`,
    )?.title ?? "Dashboard";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (section?: string) => {
    setCommandOpen(false);
    return section === undefined
      ? navigate({ to: "/admin" })
      : navigate({ to: "/admin/$section", params: { section } });
  };

  const renderItems = (items: ReadonlyArray<NavItem>) =>
    items.map((item) => {
      const { section } = item;
      const active =
        section === undefined ? pathname === "/admin" : pathname === `/admin/${section}`;
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
            {section === undefined ? (
              <Link to="/admin" className="admin-nav-link pressable">
                <item.icon />
                <span>{item.title}</span>
              </Link>
            ) : (
              <Link to="/admin/$section" params={{ section }} className="admin-nav-link pressable">
                <item.icon />
                <span>{item.title}</span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 justify-center border-b px-3">
          <Link to="/admin" className="pressable flex items-center gap-2 overflow-hidden">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              OS
            </span>
            <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
              {eventName}
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="py-2">
          <SidebarGroup>
            <SidebarMenu>{renderItems(dashboard)}</SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Program</SidebarGroupLabel>
            <SidebarMenu>{renderItems(program)}</SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Portals</SidebarGroupLabel>
            <SidebarMenu>{renderItems(portals)}</SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarMenu>{renderItems(settings)}</SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="pressable" />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{activeTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="pressable hidden gap-2 sm:flex"
              onClick={() => setCommandOpen(true)}
            >
              <SearchIcon />
              Jump to
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/portal" className="pressable">
                View portal
              </Link>
            </Button>
            <UserMenu user={user} />
          </div>
        </header>
        <Outlet />
      </SidebarInset>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} showCloseButton={false}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No page found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {allItems.map((item) => {
              const { section } = item;
              return (
                <CommandItem key={item.title} value={item.title} onSelect={() => void go(section)}>
                  <item.icon />
                  {item.title}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
