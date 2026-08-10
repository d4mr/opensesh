import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import type { Event } from "@opensesh/domain";
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
} from "lucide-react";

import { EventSwitcher } from "@/components/event-switcher";
import { NavMain, type AdminNavItem } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const dashboard: ReadonlyArray<AdminNavItem> = [{ title: "Dashboard", icon: <GaugeIcon /> }];
const program: ReadonlyArray<AdminNavItem> = [
  { title: "Abstracts", section: "abstracts", icon: <FileTextIcon /> },
  { title: "Sessions", section: "sessions", icon: <SquareStackIcon /> },
  { title: "Forms", section: "forms", icon: <FileInputIcon /> },
  { title: "Evaluation", section: "evaluation", icon: <ClipboardCheckIcon /> },
  { title: "Agenda", section: "agenda", icon: <CalendarDaysIcon /> },
];
const portals: ReadonlyArray<AdminNavItem> = [
  { title: "Tasks", section: "tasks", icon: <CheckSquareIcon /> },
  { title: "Portal Forms", section: "portal-forms", icon: <ListChecksIcon /> },
  { title: "File Requests", section: "file-requests", icon: <PanelTopIcon /> },
];
const settings = {
  title: "Settings",
  section: "settings",
  icon: <SettingsIcon />,
} satisfies AdminNavItem & { readonly section: string };

const personaNames: Readonly<Record<string, string>> = {
  "demo@opensesh.io": "Dana Organizer",
  "reviewer@opensesh.io": "Rey Reviewer",
  "maya.chen@retrievallabs.ai": "Maya Chen",
  "lina.haddad@checkpoint.health": "Lina Haddad",
  "jamal.reed@agentdesk.co": "Jamal Reed",
};

export function AppSidebar({
  event,
  events,
  eventDates,
  selectEvent,
  eventCreated,
  pathname,
  user,
  pendingContentChanges = 0,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly event: Event;
  readonly events: ReadonlyArray<Event>;
  readonly eventDates: string;
  readonly selectEvent: (eventId: string) => void;
  readonly eventCreated: (eventId: string) => Promise<void>;
  readonly pathname: string;
  readonly user: CurrentUserValue;
  readonly pendingContentChanges?: number;
}) {
  const name = personaNames[user.email] ?? user.email.split("@")[0] ?? user.email;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <EventSwitcher
          event={event}
          events={events}
          dates={eventDates}
          onSelect={selectEvent}
          onCreated={eventCreated}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={dashboard} pathname={pathname} />
        <NavMain
          label="Program"
          items={program.map((item) =>
            item.section === "sessions" ? { ...item, badge: pendingContentChanges } : item,
          )}
          pathname={pathname}
        />
        <NavMain label="Portals" items={portals} pathname={pathname} />
        <NavSecondary item={settings} pathname={pathname} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name, email: user.email }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
