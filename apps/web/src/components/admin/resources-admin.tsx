import type { ResourceAdmin, ResourceAttachmentKind, ResourceAudienceMode } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
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
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { SpeakerPickerDialog } from "@/components/admin/speaker-picker-dialog";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import {
  deleteResource,
  reorderResources,
  saveResource,
  uploadResourceFile,
} from "@/server-fns/resources";

const attachmentKinds = new Set<string>(["link", "file", "embed"]);
const audienceModes = new Set<string>(["all", "tracks", "contacts"]);
const isAttachmentKind = (value: string): value is ResourceAttachmentKind =>
  attachmentKinds.has(value);
const isAudienceMode = (value: string): value is ResourceAudienceMode => audienceModes.has(value);
const attachmentKind = (value: string): ResourceAttachmentKind | null =>
  isAttachmentKind(value) ? value : null;
const audienceMode = (value: string): ResourceAudienceMode | undefined =>
  isAudienceMode(value) ? value : undefined;

const fileBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? (result.split(",")[1] ?? "") : "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const attachmentIcon = {
  link: LinkIcon,
  file: FileIcon,
  embed: Code2Icon,
} satisfies Readonly<Record<ResourceAttachmentKind, typeof LinkIcon>>;

export function ResourcesAdmin() {
  const context = useAdminEvent();
  if (context === null) return null;
  return <ResourcesAdminData eventId={context.event.id} />;
}

function ResourcesAdminData({ eventId }: { readonly eventId: string }) {
  const queryClient = useQueryClient();
  const result = useSuspenseQuery(adminResourcesQuery(eventId));
  const [editing, setEditing] = useState<ResourceAdmin | null | undefined>(undefined);
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  const data = result.data.data;
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
    if (!response.ok) toast.error(response.error.message);
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

  return (
    <main className="h-[calc(100svh-var(--header-height)-1rem)] overflow-y-auto p-4 text-sm lg:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Resources</h1>
          <p className="text-sm text-muted-foreground">
            Publish handbooks, guides, links, and embeds to the speaker portal.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(null)}>
          <PlusIcon /> New resource
        </Button>
      </div>
      {data.items.length === 0 ? (
        <AdminEmptyState
          icon={FileIcon}
          title="No resources yet"
          description="Create the first page speakers will use on event day."
          action={
            <Button size="sm" onClick={() => setEditing(null)}>
              <PlusIcon /> New resource
            </Button>
          }
        />
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead>Resource</TableHead>
                <TableHead className="w-28">State</TableHead>
                <TableHead className="w-64">Audience</TableHead>
                <TableHead className="w-28">Attachment</TableHead>
                <TableHead className="w-36 text-right">Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((resource, index) => {
                const AttachmentIcon =
                  resource.attachmentKind === null ? null : attachmentIcon[resource.attachmentKind];
                return (
                  <TableRow key={resource.id} className="h-10">
                    <TableCell className="py-1.5">
                      <button
                        type="button"
                        className="pressable max-w-lg text-left"
                        onClick={() => setEditing(resource)}
                      >
                        <span className="block truncate text-sm font-medium">{resource.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {resource.subtitle || "No subtitle"}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${resource.published ? "border bg-background text-foreground" : "bg-[var(--status-draft)] text-[var(--status-draft-foreground)]"}`}
                      >
                        {resource.published ? (
                          <CircleCheckIcon className="size-3" />
                        ) : (
                          <CircleDashedIcon className="size-3" />
                        )}
                        {resource.published ? "Published" : "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 truncate py-1.5 text-xs text-muted-foreground">
                      {audienceSummary(resource)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs capitalize text-muted-foreground">
                      {AttachmentIcon === null ? (
                        "None"
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <AttachmentIcon className="size-3.5" /> {resource.attachmentKind}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
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
                        onClick={() => setEditing(resource)}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>
      )}
      {editing === undefined ? null : (
        <ResourceDialog
          eventId={eventId}
          resource={editing}
          tracks={data.tracks}
          contacts={data.contacts}
          close={() => setEditing(undefined)}
          saved={refresh}
        />
      )}
    </main>
  );
}

function ResourceDialog({
  eventId,
  resource,
  tracks,
  contacts,
  close,
  saved,
}: {
  readonly eventId: string;
  readonly resource: ResourceAdmin | null;
  readonly tracks: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }>;
  readonly contacts: ReadonlyArray<{
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly headshotUrl: string | null;
    readonly company: string | null;
    readonly workflowStatus: "invited" | "onboarding" | "confirmed" | "ready" | "declined";
  }>;
  readonly close: () => void;
  readonly saved: () => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const form = useForm({
    defaultValues: {
      title: resource?.title ?? "",
      subtitle: resource?.subtitle ?? "",
      body: resource?.body ?? "",
      published: resource?.published ?? false,
      audienceMode: resource?.audienceMode ?? "all",
      trackIds: new Set(resource?.trackIds ?? []),
      contactIds: new Set(resource?.contactIds ?? []),
      attachmentKind: resource?.attachmentKind ?? null,
      linkUrl: resource?.linkUrl ?? "",
      embedUrl: resource?.embedUrl ?? "",
    },
    onSubmit: async ({ value }) => {
      if (
        value.attachmentKind === "file" &&
        file === null &&
        (resource?.fileStorageKey ?? null) === null
      ) {
        toast.error("Choose a file to upload");
        return;
      }
      const keepExistingFile = value.attachmentKind === "file" && file === null;
      const response = await saveResource({
        data: {
          eventId,
          id: resource?.id ?? null,
          title: value.title,
          subtitle: value.subtitle,
          body: value.body,
          published: value.published,
          audienceMode: value.audienceMode,
          attachmentKind:
            value.attachmentKind === "file" && file !== null ? null : value.attachmentKind,
          linkUrl: value.attachmentKind === "link" ? value.linkUrl : null,
          embedUrl: value.attachmentKind === "embed" ? value.embedUrl : null,
          fileStorageKey: keepExistingFile ? (resource?.fileStorageKey ?? null) : null,
          fileName: keepExistingFile ? (resource?.fileName ?? null) : null,
          fileContentType: keepExistingFile ? (resource?.fileContentType ?? null) : null,
          fileSize: keepExistingFile ? (resource?.fileSize ?? null) : null,
          trackIds: [...value.trackIds],
          contactIds: [...value.contactIds],
        },
      });
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      if (file !== null) {
        const upload = await uploadResourceFile({
          data: {
            eventId,
            resourceId: response.data.id,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            base64: await fileBase64(file),
          },
        });
        if (!upload.ok) {
          toast.error(upload.error.message);
          await saved();
          return;
        }
      }
      toast.success(resource === null ? "Resource created" : "Resource saved");
      close();
      await saved();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resource === null ? "New resource" : "Edit resource"}</DialogTitle>
          <DialogDescription>
            Write the page in markdown, choose who can see it, and add one optional attachment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field name="title">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="resource-title">Title</Label>
                  <Input
                    id="resource-title"
                    autoFocus
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="subtitle">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="resource-subtitle">Subtitle</Label>
                  <Input
                    id="resource-subtitle"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>
          <form.Field name="body">
            {(field) => (
              <div className="space-y-1.5">
                <Label>Body</Label>
                <RichTextEditor
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="Add arrival details, production notes, or event-day guidance…"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="audienceMode">
            {(field) => (
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    const next = audienceMode(value);
                    if (next !== undefined) field.handleChange(next);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All speakers</SelectItem>
                    <SelectItem value="tracks">Selected tracks</SelectItem>
                    <SelectItem value="contacts">Selected speakers</SelectItem>
                  </SelectContent>
                </Select>
                {field.state.value === "tracks" ? (
                  <form.Field name="trackIds">
                    {(trackField) => (
                      <div className="grid gap-0.5 rounded-md border p-1.5 sm:grid-cols-2">
                        {tracks.map((track) => {
                          const selected = trackField.state.value.has(track.id);
                          return (
                            <label
                              key={track.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${selected ? "bg-muted" : "hover:bg-muted/60"}`}
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => {
                                  const next = new Set(trackField.state.value);
                                  if (selected) next.delete(track.id);
                                  else next.add(track.id);
                                  trackField.handleChange(next);
                                }}
                              />
                              <span
                                className="size-2.5 rounded-full border"
                                style={{ backgroundColor: track.color }}
                              />
                              {track.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </form.Field>
                ) : null}
                {field.state.value === "contacts" ? (
                  <form.Field name="contactIds">
                    {(contactField) => (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          onClick={() => setPickerOpen(true)}
                        >
                          <UsersIcon />{" "}
                          {contactField.state.value.size === 0
                            ? "Select speakers"
                            : `${contactField.state.value.size} selected`}
                        </Button>
                        <SpeakerPickerDialog
                          open={pickerOpen}
                          onOpenChange={setPickerOpen}
                          contacts={contacts}
                          value={contactField.state.value}
                          onChange={(value) => contactField.handleChange(new Set(value))}
                          title="Resource audience"
                          description="Only selected speakers will see this resource."
                        />
                      </>
                    )}
                  </form.Field>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field name="attachmentKind">
            {(field) => (
              <div className="space-y-1.5">
                <Label>Attachment</Label>
                <Select
                  value={field.state.value ?? "none"}
                  onValueChange={(value) => field.handleChange(attachmentKind(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No attachment</SelectItem>
                    <SelectItem value="link">External link</SelectItem>
                    <SelectItem value="file">Downloadable file</SelectItem>
                    <SelectItem value="embed">Embedded content</SelectItem>
                  </SelectContent>
                </Select>
                {field.state.value === "link" ? (
                  <form.Field name="linkUrl">
                    {(urlField) => (
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        value={urlField.state.value}
                        onChange={(event) => urlField.handleChange(event.target.value)}
                      />
                    )}
                  </form.Field>
                ) : null}
                {field.state.value === "embed" ? (
                  <form.Field name="embedUrl">
                    {(urlField) => (
                      <Input
                        type="url"
                        placeholder="https://docs.google.com/…"
                        value={urlField.state.value}
                        onChange={(event) => urlField.handleChange(event.target.value)}
                      />
                    )}
                  </form.Field>
                ) : null}
                {field.state.value === "file" ? (
                  <div className="space-y-1">
                    <Input
                      type="file"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    {resource === null || resource.fileName === null || file !== null ? null : (
                      <p className="text-xs text-muted-foreground">
                        Current file: {resource.fileName}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </form.Field>
          <form.Field name="published">
            {(field) => (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="resource-published">Published</Label>
                  <p className="text-xs text-muted-foreground">
                    Draft resources stay hidden from speakers.
                  </p>
                </div>
                <Switch
                  id="resource-published"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type="button" disabled={submitting} onClick={() => void form.handleSubmit()}>
                {submitting ? "Saving…" : "Save resource"}
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
