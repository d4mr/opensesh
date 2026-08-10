import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import type { Event } from "@opensesh/domain";
import {
  CalendarDaysIcon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileCheckIcon,
  FileInputIcon,
  FileTextIcon,
  GaugeIcon,
  ListChecksIcon,
  MailIcon,
  PanelTopIcon,
  Code2Icon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
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

const dashboard: ReadonlyArray<AdminNavItem> = [{ title: "Overview", icon: <GaugeIcon /> }];
const program: ReadonlyArray<AdminNavItem> = [
  { title: "Call for Papers", section: "forms", icon: <FileInputIcon /> },
  { title: "Submissions", section: "abstracts", icon: <FileTextIcon /> },
  { title: "Evaluation", section: "evaluation", icon: <ClipboardCheckIcon /> },
  { title: "Sessions", section: "sessions", icon: <SquareStackIcon /> },
  { title: "Content", section: "content", icon: <FileCheckIcon /> },
  { title: "Speakers", section: "speakers", icon: <UsersIcon /> },
  { title: "Agenda", section: "agenda", icon: <CalendarDaysIcon /> },
  { title: "Widgets", section: "widgets", icon: <Code2Icon /> },
];
const portals: ReadonlyArray<AdminNavItem> = [
  { title: "Tasks", section: "tasks", icon: <CheckSquareIcon /> },
  { title: "Deliverables", section: "file-requests", icon: <PanelTopIcon /> },
  { title: "Portal Forms", section: "portal-forms", icon: <ListChecksIcon /> },
  { title: "Email delivery", section: "emails", icon: <MailIcon /> },
];
const settings = {
  title: "Event Settings",
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
          canCreate={user.roles.admin}
        />
      </SidebarHeader>
      <SidebarContent>
        {user.roles.admin ? <NavMain items={dashboard} pathname={pathname} /> : null}
        <NavMain
          label="Program"
          items={program
            .filter((item) => user.roles.admin || item.section === "evaluation")
            .map((item) =>
              !user.roles.admin && item.section === "evaluation"
                ? { ...item, title: "My Reviews" }
                : item.section === "content"
                  ? { ...item, badge: pendingContentChanges }
                  : item,
            )}
          pathname={pathname}
        />
        {user.roles.admin ? <NavMain label="Portals" items={portals} pathname={pathname} /> : null}
        {user.roles.admin ? (
          <NavSecondary item={settings} pathname={pathname} className="mt-auto" />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name, email: user.email }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
