import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";

import { UserMenu } from "@/components/app/user-menu";

const nav = [
  { title: "Home" },
  { title: "Submissions", section: "submissions" },
  { title: "Profile", section: "profile" },
  { title: "Tasks", section: "tasks" },
];

export function PortalShell({
  eventName,
  user,
}: {
  readonly eventName: string;
  readonly user: CurrentUserValue;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-3 px-4 text-sm">
          <Link to="/portal" className="pressable truncate font-semibold">
            {eventName}
          </Link>
          <nav className="mx-auto hidden items-center rounded-full bg-muted p-1 sm:flex">
            {nav.map((item) => {
              const section = "section" in item ? item.section : undefined;
              const active =
                section === undefined ? pathname === "/portal" : pathname === `/portal/${section}`;
              const className = `portal-nav-link pressable ${active ? "portal-nav-link-active" : ""}`;
              return section === undefined ? (
                <Link key={item.title} to="/portal" className={className}>
                  {item.title}
                </Link>
              ) : (
                <Link
                  key={item.title}
                  to="/portal/$section"
                  params={{ section }}
                  className={className}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
          <UserMenu user={user} />
        </div>
        <nav className="mx-auto flex max-w-5xl items-center justify-center gap-1 px-4 pb-2 text-sm sm:hidden">
          {nav.map((item) => {
            const section = "section" in item ? item.section : undefined;
            const active =
              section === undefined ? pathname === "/portal" : pathname === `/portal/${section}`;
            const className = `portal-nav-link pressable ${active ? "portal-nav-link-active" : ""}`;
            return section === undefined ? (
              <Link key={item.title} to="/portal" className={className}>
                {item.title}
              </Link>
            ) : (
              <Link
                key={item.title}
                to="/portal/$section"
                params={{ section }}
                className={className}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
