import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import type { Event } from "@opensesh/domain";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileInputIcon,
  FileTextIcon,
  GaugeIcon,
  ListChecksIcon,
  PanelTopIcon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AdminEventContext } from "@/components/app/admin-event-context";
import { SiteHeader } from "@/components/site-header";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface NavItem {
  readonly title: string;
  readonly section?: string;
  readonly icon: LucideIcon;
}

const allItems: ReadonlyArray<NavItem> = [
  { title: "Dashboard", icon: GaugeIcon },
  { title: "Abstracts", section: "abstracts", icon: FileTextIcon },
  { title: "Sessions", section: "sessions", icon: SquareStackIcon },
  { title: "Speakers", section: "speakers", icon: UsersIcon },
  { title: "Forms", section: "forms", icon: FileInputIcon },
  { title: "Evaluation", section: "evaluation", icon: ClipboardCheckIcon },
  { title: "Agenda", section: "agenda", icon: CalendarDaysIcon },
  { title: "Tasks", section: "tasks", icon: CheckSquareIcon },
  { title: "Portal Forms", section: "portal-forms", icon: ListChecksIcon },
  { title: "File Requests", section: "file-requests", icon: PanelTopIcon },
  { title: "Settings", section: "settings", icon: SettingsIcon },
];

const readSidebarOpen = () => {
  if (typeof document === "undefined") return true;
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("sidebar_state="))
    ?.split("=")[1];
  return value === undefined ? true : value === "true";
};

const formatEventDates = (startsAt: Date, endsAt: Date) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `${month.format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
};

export function AdminShell({
  event,
  events,
  selectEvent,
  eventCreated,
  user,
}: {
  readonly event: Event;
  readonly events: ReadonlyArray<Event>;
  readonly selectEvent: (eventId: string) => void;
  readonly eventCreated: (eventId: string) => Promise<void>;
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
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (
        (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
        keyboardEvent.key.toLowerCase() === "k"
      ) {
        keyboardEvent.preventDefault();
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

  return (
    <AdminEventContext.Provider value={{ event, events, selectEvent, eventCreated }}>
      <SidebarProvider
        defaultOpen={readSidebarOpen()}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          event={event}
          events={events}
          eventDates={formatEventDates(event.startsAt, event.endsAt)}
          selectEvent={selectEvent}
          eventCreated={eventCreated}
          pathname={pathname}
          user={user}
        />
        <SidebarInset>
          <SiteHeader title={activeTitle} user={user} />
          <Outlet />
        </SidebarInset>

        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} showCloseButton={false}>
          <CommandInput placeholder="Jump to a page…" />
          <CommandList>
            <CommandEmpty>No page found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {allItems.map((item) => (
                <CommandItem
                  key={item.title}
                  value={item.title}
                  onSelect={() => void go(item.section)}
                >
                  <item.icon />
                  {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </SidebarProvider>
    </AdminEventContext.Provider>
  );
}
