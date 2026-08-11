import type { SpeakerWorkflowStatus } from "@opensesh/domain";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { WorkflowBadge, workflowLabels } from "@/components/admin/speaker-admin-dialogs";
import { SpeakerBadge } from "@/components/app/speaker-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  TableShell,
} from "@/components/ui/table";

// Structural contact shape so any speaker source (communications recipients,
// raw event contacts) can feed the same picker. Task counts and talk titles
// enrich the table when the caller has them.
export type SpeakerPickerContact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly headshotUrl: string | null;
  readonly company: string | null;
  readonly workflowStatus: SpeakerWorkflowStatus;
  readonly talkTitle?: string;
  readonly taskIncomplete?: number;
};

// Full-table speaker selection, Linear style: search, workflow filter, and
// row-fill selection over the whole directory instead of a cramped inline
// list. Selection is applied live; Done just closes.
export function SpeakerPickerDialog({
  open,
  onOpenChange,
  contacts,
  value,
  onChange,
  title = "Select speakers",
  description = "Search and filter the directory, then pick recipients.",
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly contacts: ReadonlyArray<SpeakerPickerContact>;
  readonly value: ReadonlySet<string>;
  readonly onChange: (value: ReadonlySet<string>) => void;
  readonly title?: string;
  readonly description?: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | SpeakerWorkflowStatus>("all");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (status !== "all" && contact.workflowStatus !== status) return false;
      if (query.length === 0) return true;
      return [
        `${contact.firstName} ${contact.lastName}`,
        contact.email,
        contact.company ?? "",
        contact.talkTitle ?? "",
      ].some((field) => field.toLowerCase().includes(query));
    });
  }, [contacts, search, status]);
  const showTasks = contacts.some((contact) => contact.taskIncomplete !== undefined);
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => value.has(row.id));
  const someVisibleSelected = filtered.some((row) => value.has(row.id));
  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search speakers…"
              className="h-8 pl-8"
            />
          </div>
          <Select
            value={status}
            onValueChange={(next) => {
              if (next === "all" || next in workflowLabels)
                setStatus(next as "all" | SpeakerWorkflowStatus);
            }}
          >
            <SelectTrigger size="sm" aria-label="Filter by workflow status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(workflowLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {value.size} of {contacts.length} selected
          </span>
        </div>
        <TableShell className="h-[min(56svh,26rem)] flex-none">
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 w-9">
                  <Checkbox
                    aria-label="Select all visible speakers"
                    checked={
                      allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                    }
                    onCheckedChange={(checked) => {
                      const next = new Set(value);
                      for (const row of filtered) {
                        if (checked === true) next.add(row.id);
                        else next.delete(row.id);
                      }
                      onChange(next);
                    }}
                  />
                </TableHead>
                <TableHead className="h-8 text-xs">Speaker</TableHead>
                <TableHead className="h-8 text-xs">Workflow</TableHead>
                {showTasks ? (
                  <TableHead className="h-8 text-xs text-right">Open tasks</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showTasks ? 4 : 3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No speakers match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((contact) => (
                  <TableRow
                    key={contact.id}
                    data-state={value.has(contact.id) ? "selected" : undefined}
                    className="h-9 cursor-pointer"
                    onClick={() => toggle(contact.id)}
                  >
                    <TableCell className="h-9 w-9 py-1.5">
                      <Checkbox
                        aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        checked={value.has(contact.id)}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggle(contact.id)}
                      />
                    </TableCell>
                    <TableCell className="h-9 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <SpeakerBadge
                          person={{
                            id: contact.id,
                            name: `${contact.firstName} ${contact.lastName}`,
                            image: contact.headshotUrl,
                          }}
                        />
                        <span className="truncate text-xs text-muted-foreground">
                          {contact.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="h-9 py-1.5">
                      <WorkflowBadge status={contact.workflowStatus} />
                    </TableCell>
                    {showTasks ? (
                      <TableCell className="h-9 py-1.5 text-right text-xs text-muted-foreground tabular-nums">
                        {(contact.taskIncomplete ?? 0) === 0 ? "—" : contact.taskIncomplete}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableShell>
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={value.size === 0}
            onClick={() => onChange(new Set())}
          >
            Clear selection
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
