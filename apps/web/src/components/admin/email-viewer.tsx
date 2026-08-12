import type { AdminEmail, EmailStatus } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  FlaskConicalIcon,
  MailWarningIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { Timestamp } from "@/components/app/timestamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { adminEmailsQuery } from "@/lib/mail-queries";
import { retryEmail } from "@/server-fns/mail";

const statusMeta: Readonly<
  Record<EmailStatus, { readonly label: string; readonly icon: typeof Clock3Icon }>
> = {
  queued: { label: "Queued", icon: Clock3Icon },
  demo: { label: "Demo", icon: FlaskConicalIcon },
  sent: { label: "Sent", icon: CheckCircle2Icon },
  failed: { label: "Failed", icon: MailWarningIcon },
};

const typeLabels: Readonly<Record<AdminEmail["type"], string>> = {
  confirmation: "Confirmation",
  magic_link: "Magic link",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  task_reminder: "Task reminder",
  calendar_invite: "Calendar invite",
  custom: "Custom",
};

function DeliveryBadge({ status }: { readonly status: EmailStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <Badge
      variant={status === "failed" ? "destructive" : status === "demo" ? "secondary" : "outline"}
      className="rounded-md capitalize"
    >
      <Icon /> {meta.label}
    </Badge>
  );
}

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, AdminEmail>();
const buildColumns = (timezone: string) =>
  columnHelper.columns([
    columnHelper.accessor("recipient", {
      header: "To",
      cell: ({ row }) => <span className="text-xs">{row.original.recipient}</span>,
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary" className="rounded-md">
          {typeLabels[row.original.type]}
        </Badge>
      ),
    }),
    columnHelper.accessor("subject", {
      header: "Subject",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{row.original.subject}</span>
          {row.original.icsAttached ? (
            <CalendarDaysIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="ICS attached"
            />
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ row }) => <DeliveryBadge status={row.original.status} />,
    }),
    columnHelper.accessor("sentAt", {
      header: "Sent at",
      cell: ({ row }) =>
        row.original.sentAt === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Timestamp
            value={row.original.sentAt}
            timezone={timezone}
            className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          />
        ),
    }),
  ]);

export function EmailViewer() {
  const { email } = useSearch({ from: "/admin/emails" });
  const navigate = useNavigate({ from: "/admin/emails" });
  const eventContext = useAdminEvent();
  if (eventContext === null) return null;
  return (
    <EmailViewerData
      eventId={eventContext.event.id}
      timezone={eventContext.event.timezone}
      selectedId={email}
      select={(id) => void navigate({ search: { email: id }, replace: true })}
    />
  );
}

function EmailViewerData({
  eventId,
  timezone,
  selectedId,
  select,
}: {
  readonly eventId: string;
  readonly timezone: string;
  readonly selectedId: string | undefined;
  readonly select: (id: string | undefined) => void;
}) {
  const queryClient = useQueryClient();
  const options = adminEmailsQuery(eventId);
  const query = useSuspenseQuery(options);
  const data = query.data.ok ? query.data.data : [];
  const selected = data.find((email) => email.id === selectedId) ?? null;
  const columns = useMemo(() => buildColumns(timezone), [timezone]);
  const table = useTable({ features, columns, data });
  const rows = table.getRowModel().rows;
  const pages = usePagination(rows, {
    spotlightId: selectedId,
    getId: (row) => row.original.id,
  });
  const retry = useMutation({
    mutationFn: (emailId: string) => retryEmail({ data: { eventId, emailId } }),
    onMutate: async (emailId) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData(options.queryKey);
      queryClient.setQueryData(options.queryKey, (current) =>
        current?.ok
          ? {
              ok: true as const,
              data: current.data.map((email) =>
                email.id === emailId ? { ...email, status: "queued" as const, error: null } : email,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: async (result, _emailId, context) => {
      if (!result.ok) {
        queryClient.setQueryData(options.queryKey, context.previous);
        toast.error(result.error.message);
        return;
      }
      if (result.data.status === "failed") toast.error(result.data.error ?? "Retry failed");
      else toast.success("Email retried");
      await invalidateAfterMutation(queryClient, eventId);
    },
    onError: (_error, _emailId, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous);
    },
  });

  if (!query.data.ok) return <p className="p-6 text-sm">{query.data.error.message}</p>;

  const downloadIcs = (email: AdminEmail) => {
    if (email.icsContent === null) return;
    const url = URL.createObjectURL(new Blob([email.icsContent], { type: "text/calendar" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${email.submissionId ?? "session"}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Email delivery</h1>
        <p className="text-xs text-muted-foreground">
          Every transactional message, including demo sends and calendar attachments.
        </p>
      </div>
      {rows.length === 0 ? (
        <AdminEmptyState
          icon={MailWarningIcon}
          title="No messages have been sent"
          description="Compose a speaker campaign when your recipients are ready."
          action={
            <Button asChild size="sm" className="pressable">
              <Link to="/admin/communications">Open communications</Link>
            </Button>
          }
        />
      ) : (
        <TableShell
          footer={
            <PaginationFooter
              page={pages.page}
              pageSize={pages.pageSize}
              total={rows.length}
              onPageChange={pages.setPage}
            />
          }
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {pages.pageItems.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                  onClick={() => select(row.original.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") select(row.original.id);
                  }}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && select(undefined)}>
        {selected === null ? null : (
          <DialogContent className="max-h-[90vh] gap-3 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="border-b px-5 py-4 pr-12">
              <div className="flex items-center gap-2">
                <DialogTitle className="truncate text-base">{selected.subject}</DialogTitle>
                <DeliveryBadge status={selected.status} />
              </div>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 text-xs">
                <span>To {selected.recipient}</span>
                <span aria-hidden="true">·</span>
                <span>{typeLabels[selected.type]}</span>
                {selected.provider === null ? null : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{selected.provider}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="html" className="min-h-0 gap-0 px-5 pb-5">
              <div className="flex items-center justify-between border-b">
                <TabsList variant="line">
                  <TabsTrigger value="html">Preview</TabsTrigger>
                  <TabsTrigger value="text">Plain text</TabsTrigger>
                  {selected.icsContent === null ? null : (
                    <TabsTrigger value="ics">Raw ICS</TabsTrigger>
                  )}
                </TabsList>
                <div className="flex items-center gap-2 pb-2">
                  {selected.icsContent === null ? null : (
                    <Button size="xs" variant="outline" onClick={() => downloadIcs(selected)}>
                      <DownloadIcon /> Download ICS
                    </Button>
                  )}
                  {selected.status === "failed" ? (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(selected.id)}
                    >
                      <RotateCcwIcon /> {retry.isPending ? "Retrying…" : "Retry"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {selected.error === null ? null : (
                <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {selected.error}
                </p>
              )}
              <TabsContent
                value="html"
                className="mt-3 min-h-0 overflow-auto rounded-md border bg-white"
              >
                <iframe
                  title={`Preview of ${selected.subject}`}
                  sandbox=""
                  srcDoc={selected.htmlBody}
                  className="h-[460px] w-full bg-white"
                />
              </TabsContent>
              <TabsContent value="text" className="mt-3 min-h-0 overflow-auto">
                <pre className="max-h-[460px] whitespace-pre-wrap rounded-md border bg-muted/20 p-4 font-mono text-xs leading-relaxed">
                  {selected.body}
                </pre>
              </TabsContent>
              {selected.icsContent === null ? null : (
                <TabsContent value="ics" className="mt-3 min-h-0 overflow-auto">
                  <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-4 font-mono text-xs leading-relaxed">
                    {selected.icsContent}
                  </pre>
                </TabsContent>
              )}
            </Tabs>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}
