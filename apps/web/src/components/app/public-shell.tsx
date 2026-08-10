import type { PublicProgram } from "@opensesh/domain";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

const pages = [
  { slug: "sessions", label: "Sessions" },
  { slug: "speakers", label: "Speakers" },
  { slug: "agenda", label: "Agenda" },
  { slug: "itinerary", label: "Itinerary" },
] as const;

const eventDates = (event: PublicProgram["event"]) => {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${date.format(start)}–${date.format(end)}, ${end.getFullYear()}`;
};

export function PublicShell({ event }: { readonly event: PublicProgram["event"] }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });
  const active = pages.findIndex((item) => pathname.includes(`/${item.slug}`));
  useLayoutEffect(() => {
    const element = nav.current;
    if (element === null) return;
    const update = () => {
      const target = element.querySelector<HTMLElement>(
        `[data-nav-index="${Math.max(active, 0)}"]`,
      );
      if (target !== null)
        setPill({ left: target.offsetLeft, width: target.offsetWidth, ready: true });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);
  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">{event.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {eventDates(event)}
              {event.location === null ? "" : ` · ${event.location}`}
            </p>
          </div>
          <nav
            ref={nav}
            className="relative flex w-fit items-center rounded-lg bg-muted p-1"
            aria-label="Event pages"
          >
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 rounded-md bg-background"
              style={{
                width: pill.width,
                transform: `translateX(${pill.left - 4}px)`,
                transition: pill.ready
                  ? "transform 200ms var(--ease-in-out), width 200ms var(--ease-in-out)"
                  : "none",
              }}
            />
            {pages.map((item, index) => (
              <Link
                key={item.slug}
                data-nav-index={index}
                to={`/e/$eventSlug/${item.slug}`}
                params={{ eventSlug: event.slug }}
                className="pressable relative z-10 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors [&.active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
