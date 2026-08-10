import type { SubmissionStatus } from "@opensesh/domain";

import { cn } from "@/lib/utils";

const statusClassName: Readonly<Record<SubmissionStatus, string>> = {
  draft: "bg-[var(--status-draft)] text-[var(--status-draft-foreground)]",
  pending: "bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
  maybe: "bg-[var(--status-maybe)] text-[var(--status-maybe-foreground)]",
  accepted: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  declined: "bg-[var(--status-declined)] text-[var(--status-declined-foreground)]",
  withdrawn: "bg-[var(--status-withdrawn)] text-[var(--status-withdrawn-foreground)]",
};

export function StatusBadge({
  status,
  className,
}: {
  readonly status: SubmissionStatus;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium capitalize",
        statusClassName[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
