import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem(props: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  readonly isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export const DEFAULT_PAGE_SIZE = 50;

export function usePagination<T>(
  items: ReadonlyArray<T>,
  options: {
    readonly pageSize?: number;
    readonly resetKey?: string;
    readonly spotlightId?: string;
    readonly getId?: (item: T) => string;
  } = {},
) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  React.useEffect(() => setPage(0), [options.resetKey]);
  React.useEffect(() => {
    if (options.spotlightId === undefined || options.getId === undefined) return;
    const index = items.findIndex((item) => options.getId?.(item) === options.spotlightId);
    if (index >= 0) setPage(Math.floor(index / pageSize));
  }, [items, options.getId, options.spotlightId, pageSize]);
  React.useEffect(() => setPage((current) => Math.min(current, pageCount - 1)), [pageCount]);

  return {
    page,
    pageCount,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    pageSize,
    setPage,
  };
}

export function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <div
      className={cn(
        "flex h-9 items-center justify-between border-t px-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="tabular-nums">
        Showing {first}–{last} of {total}
      </span>
      <Pagination className="mx-0 w-auto justify-end">
        <span className="mr-1 tabular-nums">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="pressable"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="pressable"
          aria-label="Next page"
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </Pagination>
    </div>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
