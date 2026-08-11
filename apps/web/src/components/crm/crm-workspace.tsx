import {
  emptyCrmFilters,
  filterCrmDirectory,
  findCrmDuplicates,
  type CrmDirectoryFilters,
  type CrmWorkspace,
} from "@opensesh/domain";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  BarChart3Icon,
  ContactRoundIcon,
  FilterXIcon,
  FolderKanbanIcon,
  ListFilterIcon,
  UserPlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ContactDetail } from "@/components/crm/contact-detail";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import {
  CampaignDialog,
  ContactEditorDialog,
  ImportDialog,
  MergeDialog,
  SegmentDialog,
} from "@/components/crm/dialogs";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { filtersFromJson, formatCrmDate } from "@/components/crm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PaginationFooter, usePagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crmContactQuery, crmWorkspaceQuery } from "@/lib/crm-queries";
import { cn } from "@/lib/utils";

type CrmTab = "directory" | "pipeline" | "segments" | "overview";
interface CrmSearch {
  readonly tab: CrmTab;
  readonly contact: string | undefined;
  readonly segment: string | undefined;
}

export function CrmWorkspacePage({
  tab,
  contact,
  segment,
  navigate,
}: CrmSearch & {
  readonly navigate: (next: CrmSearch, replace?: boolean) => void;
}) {
  const result = useSuspenseQuery(crmWorkspaceQuery);
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  const workspace = result.data.data;
  if (contact !== undefined)
    return (
      <ContactDetail
        id={contact}
        workspace={workspace}
        close={() => navigate({ tab, contact: undefined, segment }, true)}
      />
    );
  return (
    <main className="grid gap-4 p-4 text-sm lg:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Speaker CRM</h1>
        <p className="text-xs text-muted-foreground">
          {workspace.organization.name} · source and reuse speakers across every event.
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (
            value === "directory" ||
            value === "pipeline" ||
            value === "segments" ||
            value === "overview"
          )
            navigate({ tab: value, contact: undefined, segment: undefined });
        }}
      >
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="directory">
            <ContactRoundIcon /> Directory
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <FolderKanbanIcon /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="segments">
            <ListFilterIcon /> Segments
          </TabsTrigger>
          <TabsTrigger value="overview">
            <BarChart3Icon /> Overview
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "directory" ? (
        <Directory
          workspace={workspace}
          segmentId={segment}
          openContact={(id) => navigate({ tab: "directory", contact: id, segment })}
          clearSegment={() =>
            navigate({ tab: "directory", contact: undefined, segment: undefined }, true)
          }
        />
      ) : tab === "pipeline" ? (
        <PipelineBoard
          workspace={workspace}
          openContact={(id) => navigate({ tab: "pipeline", contact: id, segment: undefined })}
        />
      ) : tab === "segments" ? (
        <Segments
          workspace={workspace}
          open={(id) => navigate({ tab: "directory", contact: undefined, segment: id })}
        />
      ) : (
        <Overview workspace={workspace} />
      )}
    </main>
  );
}

function Directory({
  workspace,
  segmentId,
  openContact,
  clearSegment,
}: {
  readonly workspace: CrmWorkspace;
  readonly segmentId?: string;
  readonly openContact: (id: string) => void;
  readonly clearSegment: () => void;
}) {
  const queryClient = useQueryClient();
  // Warm the detail cache on hover so opening a contact renders from cache
  // instead of paying a worker→database round trip after the click.
  const prefetchContact = (id: string) => void queryClient.prefetchQuery(crmContactQuery(id));
  const activeSegment = workspace.segments.find((item) => item.id === segmentId);
  const [filters, setFilters] = useState<CrmDirectoryFilters>(() =>
    activeSegment === undefined ? emptyCrmFilters : filtersFromJson(activeSegment.filter),
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  useEffect(() => {
    if (activeSegment !== undefined) setFilters(filtersFromJson(activeSegment.filter));
  }, [activeSegment]);

  const rows = useMemo(
    () => filterCrmDirectory(workspace.directory, filters),
    [workspace.directory, filters],
  );
  const pages = usePagination(rows, {
    resetKey: `${segmentId ?? "all"}:${filters.search}:${filters.company}:${filters.title}:${filters.tagIds.join(",")}`,
  });
  const duplicates = useMemo(
    () => findCrmDuplicates(workspace.directory.map((row) => row.contact)),
    [workspace.directory],
  );
  const companies = Array.from(
    new Set(workspace.directory.flatMap((row) => row.contact.company ?? [])),
  ).sort();
  const titles = Array.from(
    new Set(workspace.directory.flatMap((row) => row.contact.title ?? [])),
  ).sort();
  const hasFilters =
    filters.search !== "" ||
    filters.company !== "" ||
    filters.title !== "" ||
    filters.tagIds.length > 0;
  const clear = () => {
    setFilters(emptyCrmFilters);
    clearSegment();
  };
  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(rows.map((row) => row.contact.id)) : new Set());
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  if (workspace.directory.length === 0) {
    return (
      <section className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Organization directory</h2>
            <p className="text-xs text-muted-foreground">Contacts shared across every event.</p>
          </div>
          <Button size="sm" className="pressable" onClick={() => setContactOpen(true)}>
            Add contact
          </Button>
        </div>
        <AdminEmptyState
          icon={UserPlusIcon}
          title="Build your speaker network"
          description="Add a contact once, then reuse their profile across organization events."
          action={
            <Button size="sm" className="pressable" onClick={() => setContactOpen(true)}>
              <UserPlusIcon /> Add contact
            </Button>
          }
        />
        <ContactEditorDialog open={contactOpen} onOpenChange={setContactOpen} />
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Organization directory</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} of {workspace.directory.length} contacts · grouped across events by email
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {duplicates.length === 0 ? null : (
            <Button
              size="sm"
              variant="outline"
              className="pressable"
              onClick={() => setMergeOpen(true)}
            >
              Review duplicates <Badge variant="secondary">{duplicates.length}</Badge>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="pressable"
            onClick={() => setImportOpen(true)}
          >
            Import CSV
          </Button>
          <Button size="sm" className="pressable" onClick={() => setContactOpen(true)}>
            Add contact
          </Button>
        </div>
      </div>

      {activeSegment === undefined ? null : (
        <div className="flex h-8 items-center gap-2 border-y bg-muted/30 px-2 text-xs">
          <ListFilterIcon className="size-3.5" />
          Segment <span className="font-medium">{activeSegment.name}</span>
          <span className="text-muted-foreground">updates dynamically</span>
          <Button size="xs" variant="ghost" className="ml-auto pressable" onClick={clear}>
            Clear segment
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search CRM contacts"
          placeholder="Search contacts…"
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({ ...current, search: event.target.value }))
          }
          className="h-8 min-w-48 flex-1 sm:max-w-72"
        />
        <Select
          value={filters.company || "all"}
          onValueChange={(company) =>
            setFilters((current) => ({ ...current, company: company === "all" ? "" : company }))
          }
        >
          <SelectTrigger size="sm" aria-label="Filter by company">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.title || "all"}
          onValueChange={(title) =>
            setFilters((current) => ({ ...current, title: title === "all" ? "" : title }))
          }
        >
          <SelectTrigger size="sm" aria-label="Filter by title">
            <SelectValue placeholder="Title" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All titles</SelectItem>
            {titles.map((title) => (
              <SelectItem key={title} value={title}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="pressable"
          disabled={!hasFilters}
          onClick={clear}
        >
          <FilterXIcon /> Clear filters
        </Button>
      </div>
      {workspace.tags.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Tags
          </span>
          {workspace.tags.map((tag) => {
            const active = filters.tagIds.includes(tag.id);
            return (
              <Button
                key={tag.id}
                size="xs"
                variant={active ? "secondary" : "outline"}
                className="pressable"
                aria-pressed={active}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    tagIds: active
                      ? current.tagIds.filter((id) => id !== tag.id)
                      : [...current.tagIds, tag.id],
                  }))
                }
              >
                {tag.name}
              </Button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-8 items-center gap-2 border-y bg-muted/20 px-2">
        <span className="text-xs tabular-nums">{selected.size} selected</span>
        <Button
          size="xs"
          variant="outline"
          className="pressable"
          disabled={selected.size === 0}
          onClick={() => setCampaignOpen(true)}
        >
          Email selected
        </Button>
        <Button
          size="xs"
          variant="outline"
          className="pressable"
          onClick={() => setSegmentOpen(true)}
        >
          Save current filters
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all visible contacts"
                  checked={rows.length > 0 && rows.every((row) => selected.has(row.contact.id))}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Events</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No contacts match these filters. Clear filters to see the directory.
                </TableCell>
              </TableRow>
            ) : (
              pages.pageItems.map((row) => (
                <TableRow
                  key={row.contact.id}
                  className="h-10 cursor-pointer"
                  onMouseEnter={() => prefetchContact(row.contact.id)}
                  onFocus={() => prefetchContact(row.contact.id)}
                  onClick={() => openContact(row.contact.id)}
                >
                  <TableCell className="py-0" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${row.contact.firstName} ${row.contact.lastName}`}
                      checked={selected.has(row.contact.id)}
                      onCheckedChange={(checked) => toggle(row.contact.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <p className="font-medium">
                      {row.contact.firstName} {row.contact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.contact.email}</p>
                  </TableCell>
                  <TableCell>{row.contact.title ?? "—"}</TableCell>
                  <TableCell>{row.contact.company ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.tags.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        row.tags.map((tag) => (
                          <Badge key={tag.id} variant="secondary">
                            {tag.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.events.length}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationFooter
          page={pages.page}
          pageSize={pages.pageSize}
          total={rows.length}
          onPageChange={pages.setPage}
        />
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} workspace={workspace} />
      <ContactEditorDialog open={contactOpen} onOpenChange={setContactOpen} />
      <SegmentDialog open={segmentOpen} onOpenChange={setSegmentOpen} filters={filters} />
      <CampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        workspace={workspace}
        contactIds={[...selected]}
      />
      <MergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        workspace={workspace}
        candidates={duplicates}
      />
    </section>
  );
}

function Segments({
  workspace,
  open,
}: {
  readonly workspace: CrmWorkspace;
  readonly open: (id: string) => void;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-medium">Saved segments</h2>
        <p className="text-xs text-muted-foreground">
          {workspace.segments.length} dynamic views · membership updates from current contact data.
        </p>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">
        {workspace.segments.length === 0 ? (
          <div className="py-12 text-center">
            <ListFilterIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 font-medium">No saved segments</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Filter the directory, then save the current filters.
            </p>
          </div>
        ) : (
          workspace.segments.map((segment) => {
            const filters = filtersFromJson(segment.filter);
            const members = filterCrmDirectory(workspace.directory, filters);
            return (
              <button
                key={segment.id}
                type="button"
                className="pressable flex w-full items-center px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                onClick={() => open(segment.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{segment.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      filters.company,
                      filters.title,
                      ...filters.tagIds.map(
                        (id) => workspace.tags.find((tag) => tag.id === id)?.name ?? "",
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "All contacts"}
                  </span>
                </span>
                <Badge variant="secondary">{members.length} contacts</Badge>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Overview({ workspace }: { readonly workspace: CrmWorkspace }) {
  const eventReach = new Set(
    workspace.directory.flatMap((row) => row.events.map((event) => event.eventId)),
  ).size;
  const cards = workspace.pipeline.columns.flatMap((column) => column.cards);
  const statusCounts = { open: 0, won: 0, lost: 0 };
  for (const column of workspace.pipeline.columns)
    statusCounts[column.stage.semanticStatus] += column.cards.length;
  const completeness =
    workspace.directory.length === 0
      ? 0
      : Math.round(
          (workspace.directory.reduce((total, row) => {
            const values = [
              row.contact.firstName,
              row.contact.lastName,
              row.contact.email,
              row.contact.title,
              row.contact.company,
              row.contact.bio,
              row.contact.headshotUrl,
            ];
            return (
              total +
              values.filter((value) => value !== null && value.trim().length > 0).length /
                values.length
            );
          }, 0) /
            workspace.directory.length) *
            100,
        );
  const maxStage = Math.max(1, ...workspace.pipeline.columns.map((column) => column.cards.length));
  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-6">
        {[
          ["Total contacts", workspace.directory.length],
          ["Events reached", eventReach],
          ["Open", statusCounts.open],
          ["Won", statusCounts.won],
          ["Lost", statusCounts.lost],
          ["Profile complete", `${completeness}%`],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn("px-3 py-3", index > 0 && "border-l", index > 1 && "max-md:border-t")}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Pipeline distribution</h2>
          <p className="text-xs text-muted-foreground">
            {cards.length} sourced contacts across configured stages.
          </p>
          <div className="mt-4 grid gap-3">
            {workspace.pipeline.columns.map((column) => (
              <div key={column.stage.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>
                    {column.stage.name} · {column.stage.semanticStatus}
                  </span>
                  <span className="tabular-nums">{column.cards.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (column.cards.length / maxStage) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Profile completeness</h2>
          <p className="text-xs text-muted-foreground">
            Core identity, role, company, bio, and headshot coverage.
          </p>
          <div className="mt-6 flex items-end gap-4">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {completeness}%
            </span>
            <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border">
        <div className="flex h-10 items-center justify-between border-b bg-muted/40 px-3">
          <h2 className="text-[13px] font-medium">CRM campaign history</h2>
          <span className="text-[11px] text-muted-foreground">
            {workspace.campaigns.length} campaigns
          </span>
        </div>
        <div className="divide-y">
          {workspace.campaigns.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Select directory contacts and send a campaign to create history.
            </p>
          ) : (
            workspace.campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{campaign.subject}</span>
                  <span className="block text-xs text-muted-foreground">
                    {campaign.eventName} · {campaign.recipients.length} recipients ·{" "}
                    {campaign.sentAt === null ? "Draft" : formatCrmDate(campaign.sentAt)}
                  </span>
                </span>
                <Badge variant="outline" className="capitalize">
                  {campaign.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
