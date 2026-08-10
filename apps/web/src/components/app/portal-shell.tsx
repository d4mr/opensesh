import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import type { Event } from "@opensesh/domain";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

import { UserMenu } from "@/components/app/user-menu";
import { EventIcon } from "@/components/app/event-icon";

const nav = [
  { title: "Home" },
  { title: "My Submissions", section: "submissions" },
  { title: "My Sessions", section: "sessions" },
  { title: "Tasks", section: "tasks" },
  { title: "Profile", section: "profile" },
];

const activeIndexForPath = (pathname: string) =>
  nav.findIndex((item) =>
    "section" in item ? pathname === `/portal/${item.section}` : pathname === "/portal",
  );

function NavLink({
  item,
  className,
}: {
  readonly item: (typeof nav)[number];
  readonly className: string;
}) {
  return "section" in item && item.section !== undefined ? (
    <Link
      to="/portal/$section"
      params={{ section: item.section }}
      search={{ spotlight: undefined }}
      className={className}
    >
      {item.title}
    </Link>
  ) : (
    <Link to="/portal" className={className}>
      {item.title}
    </Link>
  );
}

function DesktopPillNav({ pathname }: { readonly pathname: string }) {
  const listRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = activeIndexForPath(pathname);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null || activeIndex < 0) {
      setIndicator(null);
      return;
    }
    const measure = () => {
      const link = list.querySelectorAll("a")[activeIndex];
      if (link instanceof HTMLElement) {
        // Rect delta, not offsetLeft: the pill is anchored at left-0, and
        // offsetLeft/static-position origins disagree inside a padded parent.
        const linkRect = link.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        setIndicator({ left: linkRect.left - listRect.left, width: linkRect.width });
      }
    };
    measure();
    // Re-measure on container resize (font swap, viewport changes).
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex]);

  return (
    <nav
      ref={listRef}
      className="relative mx-auto hidden items-center rounded-full bg-muted p-1 sm:flex"
    >
      {indicator === null ? null : (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-full bg-background shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-[transform,width] duration-200 [transition-timing-function:var(--ease-out)] motion-reduce:transition-none"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
      )}
      {nav.map((item, index) => (
        <NavLink
          key={item.title}
          item={item}
          className={`portal-nav-link pressable relative ${index === activeIndex ? "portal-nav-link-current" : ""}`}
        />
      ))}
    </nav>
  );
}

export function PortalShell({
  event,
  user,
}: {
  readonly event: Event;
  readonly user: CurrentUserValue;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeIndex = activeIndexForPath(pathname);

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-3 px-4 text-sm">
          <Link
            to="/portal"
            className="pressable flex min-w-0 items-center gap-2 truncate font-semibold"
          >
            <EventIcon src={event.logoUrl} size={24} />
            <span className="truncate">{event.name}</span>
          </Link>
          <DesktopPillNav pathname={pathname} />
          <UserMenu user={user} />
        </div>
        <nav className="mx-auto flex max-w-5xl items-center justify-center gap-1 px-4 pb-2 text-sm sm:hidden">
          {nav.map((item, index) => (
            <NavLink
              key={item.title}
              item={item}
              className={`portal-nav-link pressable ${index === activeIndex ? "portal-nav-link-active" : ""}`}
            />
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
