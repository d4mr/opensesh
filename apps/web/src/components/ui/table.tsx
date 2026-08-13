import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

// The one way a table (or list) with chrome renders: bordered shell, content
// scrolling in its own region, column headers stuck to the top of that region,
// and the footer (paginator) pinned below it. Give the shell height with
// flex-1/h-* from the caller; never put the footer inside the scroll area.
function TableShell({
  footer,
  scrollRef,
  className,
  contentClassName,
  children,
}: {
  readonly footer?: React.ReactNode;
  readonly scrollRef?: React.Ref<HTMLDivElement>;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      data-slot="table-shell"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border", className)}
    >
      <div
        ref={scrollRef}
        className={cn(
          // overscroll-none kills the macOS rubber-band at the table's edges;
          // an app table is chrome, not a page, so it should stop dead.
          "min-h-0 flex-1 overflow-auto overscroll-none",
          "[&_[data-slot=table-container]]:overflow-x-visible",
          "[&_[data-slot=table-header]]:sticky [&_[data-slot=table-header]]:top-0 [&_[data-slot=table-header]]:z-10 [&_[data-slot=table-header]]:bg-background",
          // Collapsed tr borders don't travel with a sticky thead; draw the
          // hairline as an inset shadow on the cells instead.
          "[&_[data-slot=table-header]_tr]:border-b-0",
          "[&_[data-slot=table-header]_th]:shadow-[inset_0_-1px_0_0_var(--border)]",
          // scrollIntoView must clear the sticky header — without the margin,
          // scrolling a row to the top edge parks it underneath the thead.
          "[&_tbody_tr]:scroll-mt-10",
          // Overlay scrollbars float above content; give the last column a
          // wider gutter so right-aligned values stay readable while scrolling.
          "[&_[data-slot=table]_td:last-child]:pr-4 [&_[data-slot=table]_th:last-child]:pr-4",
          contentClassName,
        )}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableShell,
};
