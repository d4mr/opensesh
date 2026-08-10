import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

import { UserMenu } from "@/components/app/user-menu";

const nav = [
  { title: "Home" },
  { title: "Submissions", section: "submissions" },
  { title: "Profile", section: "profile" },
  { title: "Tasks", section: "tasks" },
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
    <Link to="/portal/$section" params={{ section: item.section }} className={className}>
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
  eventName,
  user,
}: {
  readonly eventName: string;
  readonly user: CurrentUserValue;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeIndex = activeIndexForPath(pathname);

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-3 px-4 text-sm">
          <Link to="/portal" className="pressable truncate font-semibold">
            {eventName}
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
