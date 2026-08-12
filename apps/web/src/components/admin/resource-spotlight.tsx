import type { ResourceAdmin, ResourceAttachmentKind, ResourceAudienceMode } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import {
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  PencilIcon,
  SaveIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SpeakerPickerDialog } from "@/components/admin/speaker-picker-dialog";
import { SpotlightPanelHeader } from "@/components/app/spotlight";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { PortalResourceItem } from "@/components/portal/portal-resource-item";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveResource, uploadResourceFile } from "@/server-fns/resources";

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

type ResourceTrack = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
};

type ResourceContact = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly headshotUrl: string | null;
  readonly company: string | null;
  readonly workflowStatus: "invited" | "onboarding" | "confirmed" | "ready" | "declined";
};

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function PreviewAttachment({
  kind,
  linkUrl,
  embedUrl,
  fileName,
}: {
  readonly kind: ResourceAttachmentKind | null;
  readonly linkUrl: string;
  readonly embedUrl: string;
  readonly fileName: string | null;
}) {
  if (kind === "link") {
    return linkUrl === "" ? (
      <p className="text-xs text-muted-foreground">Add a URL to preview this link.</p>
    ) : (
      <Button asChild size="sm">
        <a href={linkUrl} target="_blank" rel="noreferrer">
          Open resource <ExternalLinkIcon />
        </a>
      </Button>
    );
  }
  if (kind === "file") {
    return fileName === null ? (
      <p className="text-xs text-muted-foreground">Choose a file to preview its download link.</p>
    ) : (
      <Button size="sm" type="button">
        <DownloadIcon /> Download {fileName}
      </Button>
    );
  }
  if (kind === "embed") {
    return embedUrl === "" ? (
      <p className="text-xs text-muted-foreground">Add an embed URL to preview it here.</p>
    ) : (
      <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/30">
        <iframe
          title="Resource attachment preview"
          src={embedUrl}
          className="size-full border-0"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="origin"
          allowFullScreen
        />
      </div>
    );
  }
  return null;
}

export function ResourceSpotlight({
  eventId,
  resource,
  tracks,
  contacts,
  onClose,
  onSaved,
  onDelete,
}: {
  readonly eventId: string;
  readonly resource: ResourceAdmin | null;
  readonly tracks: ReadonlyArray<ResourceTrack>;
  readonly contacts: ReadonlyArray<ResourceContact>;
  readonly onClose: () => void;
  readonly onSaved: (id: string) => Promise<void>;
  readonly onDelete: (() => Promise<void>) | undefined;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewOpen, setPreviewOpen] = useState(true);
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
          await onSaved(response.data.id);
          return;
        }
        setFile(null);
      }
      toast.success(resource === null ? "Resource created" : "Resource saved");
      await onSaved(response.data.id);
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SpotlightPanelHeader
        identity={
          <form.Subscribe selector={(state) => state.values.title}>
            {(title) => (
              <span className="truncate text-sm font-medium">
                {title.trim() || (resource === null ? "New resource" : "Untitled resource")}
              </span>
            )}
          </form.Subscribe>
        }
        status={
          <form.Subscribe selector={(state) => state.values.published}>
            {(published) => (
              <span
                className={
                  published
                    ? "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium"
                    : "rounded-sm bg-[var(--status-draft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-draft-foreground)]"
                }
              >
                {published ? "Published" : "Draft"}
              </span>
            )}
          </form.Subscribe>
        }
        actions={
          <div className="flex items-center gap-1">
            {onDelete === undefined ? null : (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="pressable text-muted-foreground hover:text-destructive"
                aria-label="Delete resource"
                onClick={() => void onDelete()}
              >
                <Trash2Icon />
              </Button>
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button
                  type="button"
                  size="xs"
                  className="pressable"
                  disabled={submitting}
                  onClick={() => void form.handleSubmit()}
                >
                  <SaveIcon /> {submitting ? "Saving…" : "Save"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        }
        onClose={onClose}
      />

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value === "preview" ? "preview" : "edit")}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex h-10 shrink-0 items-end border-b px-3">
          <TabsList variant="line" className="h-9">
            <TabsTrigger value="edit" className="h-9 gap-1.5 text-xs">
              <PencilIcon /> Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-9 gap-1.5 text-xs">
              <EyeIcon /> Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edit" className="mt-0 min-h-0 overflow-y-auto">
          <div className="mx-auto grid max-w-3xl gap-6 p-4 pb-16 lg:p-6 lg:pb-16">
            <section className="grid gap-3">
              <SectionLabel>Content</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <form.Field name="title">
                  {(field) => (
                    <div className="grid gap-1.5">
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
                    <div className="grid gap-1.5">
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
                  <div className="grid gap-1.5">
                    <Label>Page content</Label>
                    <RichTextEditor
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder="Add arrival details, production notes, or event-day guidance…"
                    />
                  </div>
                )}
              </form.Field>
            </section>

            <section className="grid gap-3">
              <SectionLabel>Visibility</SectionLabel>
              <form.Field name="audienceMode">
                {(field) => (
                  <div className="grid gap-1.5">
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
                              <UsersIcon />
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
              <form.Field name="published">
                {(field) => (
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <span>
                      <span className="block text-[13px] font-medium">Published</span>
                      <span className="block text-xs text-muted-foreground">
                        Draft resources stay hidden from speakers.
                      </span>
                    </span>
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  </label>
                )}
              </form.Field>
            </section>

            <section className="grid gap-3">
              <SectionLabel>Attachment</SectionLabel>
              <form.Field name="attachmentKind">
                {(field) => (
                  <div className="grid gap-2">
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
                            aria-label="External link URL"
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
                            aria-label="Embed URL"
                            placeholder="https://docs.google.com/…"
                            value={urlField.state.value}
                            onChange={(event) => urlField.handleChange(event.target.value)}
                          />
                        )}
                      </form.Field>
                    ) : null}
                    {field.state.value === "file" ? (
                      <div className="grid gap-1.5">
                        <Input
                          type="file"
                          aria-label="Resource file"
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
            </section>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0 min-h-0 overflow-y-auto bg-muted/20">
          <form.Subscribe selector={(state) => state.values}>
            {(value) => (
              <div className="mx-auto max-w-4xl p-4 pb-16 lg:p-6 lg:pb-16">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">Speaker portal preview</p>
                    <p className="text-[11px] text-muted-foreground">
                      Live preview · includes unsaved changes
                    </p>
                  </div>
                  {value.published ? null : (
                    <span className="rounded-sm bg-[var(--status-draft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-draft-foreground)]">
                      Hidden while draft
                    </span>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border bg-background">
                  <div className="border-b px-4 py-4 sm:px-6">
                    <h2 className="text-xl font-semibold tracking-tight">Resources</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Event-day guides and materials from the organizing team.
                    </p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="overflow-hidden rounded-lg border divide-y">
                      <PortalResourceItem
                        title={value.title}
                        subtitle={value.subtitle}
                        body={value.body}
                        open={previewOpen}
                        onToggle={() => setPreviewOpen((open) => !open)}
                        attachment={
                          value.attachmentKind === null ? undefined : (
                            <PreviewAttachment
                              kind={value.attachmentKind}
                              linkUrl={value.linkUrl}
                              embedUrl={value.embedUrl}
                              fileName={file?.name ?? resource?.fileName ?? null}
                            />
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <FileTextIcon className="size-3" /> Audience rules affect who sees the resource,
                  not how it renders.
                </p>
              </div>
            )}
          </form.Subscribe>
        </TabsContent>
      </Tabs>
    </div>
  );
}
