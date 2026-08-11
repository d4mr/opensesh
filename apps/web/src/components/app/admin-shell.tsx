import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import type { Event } from "@opensesh/domain";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  Code2Icon,
  CheckSquareIcon,
  ClipboardCheckIcon,
  FileCheckIcon,
  FileInputIcon,
  FilesIcon,
  FileTextIcon,
  GaugeIcon,
  ListChecksIcon,
  MailIcon,
  SendIcon,
  PanelTopIcon,
  SettingsIcon,
  SquareStackIcon,
  UsersIcon,
  ContactRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";

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
import { adminPortalQuery } from "@/lib/portal-queries";
import { crmWorkspaceQuery } from "@/lib/crm-queries";

interface NavItem {
  readonly title: string;
  readonly section?: string;
  readonly icon: LucideIcon;
}

const allItems: ReadonlyArray<NavItem> = [
  { title: "Overview", icon: GaugeIcon },
  { title: "Speaker CRM", section: "crm", icon: ContactRoundIcon },
  { title: "Submissions", section: "abstracts", icon: FileTextIcon },
  { title: "Sessions", section: "sessions", icon: SquareStackIcon },
  { title: "Content", section: "content", icon: FileCheckIcon },
  { title: "Speakers", section: "speakers", icon: UsersIcon },
  { title: "Call for Papers", section: "forms", icon: FileInputIcon },
  { title: "Evaluation", section: "evaluation", icon: ClipboardCheckIcon },
  { title: "Agenda", section: "agenda", icon: CalendarDaysIcon },
  { title: "Widgets", section: "widgets", icon: Code2Icon },
  { title: "Tasks", section: "tasks", icon: CheckSquareIcon },
  { title: "Email delivery", section: "emails", icon: MailIcon },
  { title: "Communications", section: "communications", icon: SendIcon },
  { title: "Portal Forms", section: "portal-forms", icon: ListChecksIcon },
  { title: "Deliverables", section: "file-requests", icon: PanelTopIcon },
  { title: "Files", section: "files", icon: FilesIcon },
  { title: "Event Settings", section: "settings", icon: SettingsIcon },
];

const readSidebarOpen = () => {
  if (typeof document === "undefined") return true;
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("sidebar_state="))
    ?.split("=")[1];
  return value === undefined ? true : value === "true";
};

// Format in the event's timezone so SSR (UTC) and the browser agree — a
// naive local-TZ format hydration-mismatches for viewers east of UTC.
const formatEventDates = (startsAt: Date, endsAt: Date, timezone: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: timezone });
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone });
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: timezone });
  return `${month.format(start)} ${day.format(start)}–${day.format(end)}, ${year.format(end)}`;
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
  // SSR can't see document.cookie, so both server HTML and the first client
  // render assume open; the stored preference applies pre-paint (no flash,
  // no hydration mismatch — this was a live React #418 source in prod).
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useLayoutEffect(() => {
    if (!readSidebarOpen()) setSidebarOpen(false);
  }, []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const portal = useQuery({ ...adminPortalQuery(event.id), enabled: user.roles.admin });
  const crmMode = pathname === "/admin/crm" || pathname.startsWith("/admin/crm/");
  const organizationMode = crmMode;
  const crm = useQuery({ ...crmWorkspaceQuery, enabled: crmMode && user.roles.admin });
  const organizationName = crm.data?.ok === true ? crm.data.data.organization.name : undefined;
  const organizationLogo = crm.data?.ok === true ? crm.data.data.organization.logo : null;
  const pendingContentChanges =
    portal.data?.ok === true
      ? portal.data.data.history.filter(
          (entry) => entry.history.approvalStatus === "pending_review",
        ).length
      : 0;
  const navigationItems = user.roles.admin
    ? allItems
    : [{ title: "My Reviews", section: "evaluation", icon: ClipboardCheckIcon }];
  const activeTitle =
    navigationItems.find((item) =>
      item.section === undefined
        ? pathname === "/admin"
        : pathname === `/admin/${item.section}` || pathname.startsWith(`/admin/${item.section}/`),
    )?.title ?? "Overview";
  const headerTitle = crmMode ? `Speaker CRM · ${organizationName ?? "Organization"}` : activeTitle;

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
    if (section === undefined) return navigate({ to: "/admin" });
    if (section === "abstracts")
      return navigate({
        to: "/admin/abstracts",
        search: { status: "all", spotlight: undefined },
      });
    if (section === "sessions")
      return navigate({
        to: "/admin/sessions",
        search: { status: "all", spotlight: undefined },
      });
    if (section === "forms") return navigate({ to: "/admin/forms" });
    if (section === "evaluation") return navigate({ to: "/admin/evaluation" });
    if (section === "agenda")
      return navigate({
        to: "/admin/agenda",
        search: { view: "rooms", day: undefined, draft: undefined },
      });
    if (section === "widgets")
      return navigate({ to: "/admin/widgets", search: { widget: undefined } });
    if (section === "emails") return navigate({ to: "/admin/emails" });
    if (section === "communications") return navigate({ to: "/admin/communications" });
    if (section === "files")
      return navigate({
        to: "/admin/files",
        search: { deliverable: undefined, spotlight: undefined },
      });
    if (section === "crm")
      return navigate({
        to: "/admin/crm",
        search: { tab: "directory", contact: undefined, segment: undefined },
      });
    return navigate({
      to: "/admin/$section",
      params: { section },
      search: { spotlight: undefined, fileRequest: undefined },
    });
  };

  return (
    <AdminEventContext.Provider value={{ event, events, selectEvent, eventCreated }}>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
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
          eventDates={formatEventDates(event.startsAt, event.endsAt, event.timezone)}
          selectEvent={selectEvent}
          eventCreated={eventCreated}
          pathname={pathname}
          user={user}
          pendingContentChanges={pendingContentChanges}
          organizationMode={organizationMode}
          organizationName={organizationName}
          organizationLogo={organizationLogo}
        />
        <SidebarInset className="min-w-0">
          <SiteHeader title={headerTitle} user={user} />
          <Outlet />
        </SidebarInset>

        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} showCloseButton={false}>
          <CommandInput placeholder="Jump to a page…" />
          <CommandList>
            <CommandEmpty>No page found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {navigationItems.map((item) => (
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
