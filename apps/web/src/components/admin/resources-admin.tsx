import type { ResourceAdmin, ResourceAttachmentKind } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  Code2Icon,
  FileIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { ResourceSpotlight } from "@/components/admin/resource-spotlight";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { SpotlightLayout } from "@/components/app/spotlight";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { adminResourcesQuery } from "@/lib/resource-queries";
import { cn } from "@/lib/utils";
import { deleteResource, reorderResources } from "@/server-fns/resources";

const NEW_RESOURCE_ID = "new";

const attachmentIcon = {
  link: LinkIcon,
  file: FileIcon,
  embed: Code2Icon,
} satisfies Readonly<Record<ResourceAttachmentKind, typeof LinkIcon>>;

interface SpotlightChangeOptions {
  readonly replace: boolean;
  readonly keyboard: boolean;
}

export function ResourcesAdmin({
  spotlightId,
  onSpotlightChange,
}: {
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (id: string | undefined, options: SpotlightChangeOptions) => void;
}) {
  const context = useAdminEvent();
  if (context === null) return null;
  return (
    <ResourcesAdminData
      eventId={context.event.id}
      spotlightId={spotlightId}
      onSpotlightChange={onSpotlightChange}
    />
  );
}

function ResourcesAdminData({
  eventId,
  spotlightId,
  onSpotlightChange,
}: {
  readonly eventId: string;
  readonly spotlightId: string | undefined;
  readonly onSpotlightChange: (id: string | undefined, options: SpotlightChangeOptions) => void;
}) {
  const queryClient = useQueryClient();
  const result = useSuspenseQuery(adminResourcesQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  const data = result.data.data;
  const selected =
    spotlightId === NEW_RESOURCE_ID
      ? null
      : data.items.find((resource) => resource.id === spotlightId);
  const orderedIds = [
    ...data.items.map((resource) => resource.id),
    ...(spotlightId === NEW_RESOURCE_ID ? [NEW_RESOURCE_ID] : []),
  ];
  const refresh = () => invalidateAfterMutation(queryClient, eventId);
  const reorder = useMutation({
    mutationFn: (ids: ReadonlyArray<string>) =>
      reorderResources({ data: { eventId, resourceIds: [...ids] } }),
    onSuccess: async (response) => {
      if (!response.ok) toast.error(response.error.message);
      await refresh();
    },
  });
  const move = (index: number, offset: -1 | 1) => {
    const next = [...data.items];
    const target = index + offset;
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[target] = current;
    void reorder.mutateAsync(next.map((item) => item.id));
  };
  const remove = async (resource: ResourceAdmin) => {
    if (!window.confirm(`Delete “${resource.title}”?`)) return;
    const response = await deleteResource({ data: { eventId, id: resource.id } });
    if (!response.ok) {
      toast.error(response.error.message);
      return;
    }
    if (spotlightId === resource.id) {
      onSpotlightChange(undefined, { replace: true, keyboard: false });
    }
    await refresh();
  };
  const audienceSummary = (resource: ResourceAdmin) => {
    if (resource.audienceMode === "all") return "All speakers";
    if (resource.audienceMode === "tracks") {
      const names = data.tracks
        .filter((track) => resource.trackIds.includes(track.id))
        .map((track) => track.name);
      return names.length === 0 ? "No tracks" : names.join(", ");
    }
    const names = data.contacts
      .filter((contact) => resource.contactIds.includes(contact.id))
      .map((contact) => `${contact.firstName} ${contact.lastName}`);
    return names.length === 0
      ? "No speakers"
      : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`;
  };
  const openNew = () => onSpotlightChange(NEW_RESOURCE_ID, { replace: false, keyboard: false });

  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col overflow-hidden text-sm">
      <SpotlightLayout
        spotlightId={spotlightId}
        orderedIds={orderedIds}
        onSpotlightChange={onSpotlightChange}
        list={({ compact, scrollRef, openSpotlight, rowRef, rowClassName }) => (
          <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">Resources</h1>
                <p className="text-xs text-muted-foreground">
                  Publish handbooks, guides, links, and embeds to the speaker portal.
                </p>
              </div>
              <Button size="sm" className="pressable" onClick={openNew}>
                <PlusIcon /> New resource
              </Button>
            </div>
            {data.items.length === 0 ? (
              <AdminEmptyState
                icon={FileIcon}
                title="No resources yet"
                description="Create the first page speakers will use on event day."
                action={
                  <Button size="sm" className="pressable" onClick={openNew}>
                    <PlusIcon /> New resource
                  </Button>
                }
              />
            ) : (
              <TableShell scrollRef={scrollRef}>
                <Table>
                  <TableHeader>
                    <TableRow className="h-8">
                      <TableHead>Resource</TableHead>
                      <TableHead className="w-28">State</TableHead>
                      {compact ? null : <TableHead className="w-64">Audience</TableHead>}
                      {compact ? null : <TableHead className="w-28">Attachment</TableHead>}
                      {compact ? null : <TableHead className="w-36 text-right">Order</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((resource, index) => {
                      const AttachmentIcon =
                        resource.attachmentKind === null
                          ? null
                          : attachmentIcon[resource.attachmentKind];
                      return (
                        <TableRow
                          key={resource.id}
                          ref={rowRef(resource.id)}
                          className={cn("h-10 cursor-pointer", rowClassName(resource.id))}
                          onClick={() => openSpotlight(resource.id)}
                        >
                          <TableCell className="h-10 max-w-80 py-1.5">
                            <span className="block truncate text-sm font-medium">
                              {resource.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {resource.subtitle || "No subtitle"}
                            </span>
                          </TableCell>
                          <TableCell className="h-10 py-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
                                resource.published
                                  ? "border bg-background text-foreground"
                                  : "bg-[var(--status-draft)] text-[var(--status-draft-foreground)]",
                              )}
                            >
                              {resource.published ? (
                                <CircleCheckIcon className="size-3" />
                              ) : (
                                <CircleDashedIcon className="size-3" />
                              )}
                              {resource.published ? "Published" : "Draft"}
                            </span>
                          </TableCell>
                          {compact ? null : (
                            <TableCell className="h-10 max-w-64 truncate py-1.5 text-xs text-muted-foreground">
                              {audienceSummary(resource)}
                            </TableCell>
                          )}
                          {compact ? null : (
                            <TableCell className="h-10 py-1.5 text-xs capitalize text-muted-foreground">
                              {AttachmentIcon === null ? (
                                "None"
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  <AttachmentIcon className="size-3.5" />
                                  {resource.attachmentKind}
                                </span>
                              )}
                            </TableCell>
                          )}
                          {compact ? null : (
                            <TableCell
                              className="h-10 py-1.5 text-right"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Move ${resource.title} up`}
                                disabled={index === 0 || reorder.isPending}
                                onClick={() => move(index, -1)}
                              >
                                <ArrowUpIcon />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Move ${resource.title} down`}
                                disabled={index === data.items.length - 1 || reorder.isPending}
                                onClick={() => move(index, 1)}
                              >
                                <ArrowDownIcon />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Edit ${resource.title}`}
                                onClick={() => openSpotlight(resource.id)}
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Delete ${resource.title}`}
                                onClick={() => void remove(resource)}
                              >
                                <Trash2Icon />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableShell>
            )}
          </div>
        )}
        panel={
          selected === undefined ? null : (
            <ResourceSpotlight
              key={selected?.id ?? NEW_RESOURCE_ID}
              eventId={eventId}
              resource={selected}
              tracks={data.tracks}
              contacts={data.contacts}
              onClose={() => onSpotlightChange(undefined, { replace: true, keyboard: false })}
              onSaved={async (id) => {
                await refresh();
                if (selected === null) {
                  onSpotlightChange(id, { replace: true, keyboard: false });
                }
              }}
              onDelete={selected === null ? undefined : () => remove(selected)}
            />
          )
        }
      />
    </main>
  );
}
