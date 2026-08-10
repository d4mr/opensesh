import type { FormStatus, SubmissionStatus } from "@opensesh/domain";

import { cn } from "@/lib/utils";

type Status = SubmissionStatus | FormStatus;

const statusClassName: Readonly<Record<Status, string>> = {
  draft: "bg-[var(--status-draft)] text-[var(--status-draft-foreground)]",
  pending: "bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
  maybe: "bg-[var(--status-maybe)] text-[var(--status-maybe-foreground)]",
  accepted: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  declined: "bg-[var(--status-declined)] text-[var(--status-declined-foreground)]",
  withdrawn: "bg-[var(--status-withdrawn)] text-[var(--status-withdrawn-foreground)]",
  open: "bg-[var(--status-open)] text-[var(--status-open-foreground)]",
  closed: "bg-[var(--status-closed)] text-[var(--status-closed-foreground)]",
};

export function StatusBadge({
  status,
  className,
}: {
  readonly status: Status;
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
