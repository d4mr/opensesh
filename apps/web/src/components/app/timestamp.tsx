import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// The one way a point in time renders. The visible text is pinned to the
// event timezone (or UTC when no event applies) so SSR on the UTC worker and
// the browser produce identical markup — an unpinned formatter
// hydration-mismatches. Hovering reveals the full picture: how long ago,
// event time, UTC, and the viewer's local time. Tooltip content only mounts
// on hover, so browser-local text never reaches SSR.

const visibleFormat = (timezone: string, mode: "datetime" | "date") =>
  new Intl.DateTimeFormat(
    "en-US",
    mode === "datetime"
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone }
      : { month: "short", day: "numeric", year: "numeric", timeZone: timezone },
  );

const fullFormat = (timezone?: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  });

export const relativeLabel = (date: Date) => {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return formatter.format(seconds, "second");
  if (magnitude < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (magnitude < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (magnitude < 30 * 86_400) return formatter.format(Math.round(seconds / 86_400), "day");
  if (magnitude < 365 * 86_400)
    return formatter.format(Math.round(seconds / (30 * 86_400)), "month");
  return formatter.format(Math.round(seconds / (365 * 86_400)), "year");
};

function TimestampRows({ date, timezone }: { readonly date: Date; readonly timezone?: string }) {
  const rows: Array<{ readonly label: string; readonly value: string }> = [];
  if (timezone !== undefined)
    rows.push({ label: "Event", value: fullFormat(timezone).format(date) });
  rows.push({ label: "UTC", value: fullFormat("UTC").format(date) });
  const local = fullFormat().format(date);
  // Skip rows that would repeat an earlier one verbatim — no redundant lines.
  if (!rows.some((row) => row.value === local)) rows.push({ label: "Local", value: local });
  const deduped = rows.filter(
    (row, index) => rows.findIndex((other) => other.value === row.value) === index,
  );
  return (
    <div className="grid gap-1">
      <p className="font-medium">{relativeLabel(date)}</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {deduped.map((row) => (
          <div key={row.label} className="contents">
            <span className="text-background/60">{row.label}</span>
            <span className="tabular-nums whitespace-nowrap">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Timestamp({
  value,
  timezone,
  mode = "datetime",
  className,
  children,
}: {
  readonly value: Date | string | number;
  /** Event timezone; omit on organization-level surfaces (pins visible text to UTC). */
  readonly timezone?: string;
  readonly mode?: "datetime" | "date";
  readonly className?: string;
  /** Custom visible text (e.g. a relative label); defaults to the pinned event-time text. */
  readonly children?: ReactNode;
}) {
  const date = new Date(value);
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default", className)} suppressHydrationWarning>
          {children ?? visibleFormat(timezone ?? "UTC", mode).format(date)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-left">
        <TimestampRows date={date} timezone={timezone} />
      </TooltipContent>
    </Tooltip>
  );
}
