import type { Event, EventType } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CopyIcon, ImageUpIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EventIcon } from "@/components/app/event-icon";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { DateTimePicker } from "@/components/forms/datetime-picker";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { TimezoneCombobox } from "@/components/forms/timezone-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fileAsBase64 } from "@/lib/files";
import { cn } from "@/lib/utils";
import { updateEventSettings } from "@/server-fns/admin";

export const Route = createFileRoute("/admin/settings/event")({ component: EventSettings });

const eventType = (value: string): EventType =>
  value === "summit" || value === "meetup" ? value : "conference";

function SettingsSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-9 items-center border-b bg-muted/30 px-3">
        <h2 className="text-xs font-medium">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EventSettings() {
  const context = useAdminEvent();
  if (context === null) return null;
  return <EventSettingsForm key={context.event.id} event={context.event} />;
}

function EventSettingsForm({ event }: { readonly event: Event }) {
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(event.logoUrl);

  useEffect(() => {
    if (icon === null) {
      setPreviewUrl(event.logoUrl);
      return;
    }
    const url = URL.createObjectURL(icon);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [event.logoUrl, icon]);

  const chooseIcon = (file: File | undefined) => {
    if (file === undefined) return;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast.error("Use a PNG, JPG, or SVG event icon");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Event icons must be 2 MB or smaller");
      return;
    }
    setIcon(file);
  };

  const form = useForm({
    defaultValues: {
      name: event.name,
      tagline: event.tagline ?? "",
      description: event.description ?? "",
      type: event.type,
      websiteUrl: event.websiteUrl ?? "",
      location: event.location ?? "",
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: event.timezone,
      logoUrl: event.logoUrl ?? "",
      defaultSubmissionLimit: event.defaultSubmissionLimit,
    },
    onSubmit: async ({ value }) => {
      if (new Date(value.endsAt) <= new Date(value.startsAt)) {
        toast.error("Event end must be after start");
        return;
      }
      const logoUpload =
        icon === null
          ? null
          : {
              filename: icon.name,
              contentType: icon.type,
              size: icon.size,
              base64: await fileAsBase64(icon),
            };
      const result = await updateEventSettings({
        data: {
          eventId: event.id,
          name: value.name,
          tagline: value.tagline || null,
          description: value.description || null,
          type: value.type,
          websiteUrl: value.websiteUrl || null,
          location: value.location || null,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          timezone: value.timezone,
          logoUrl: value.logoUrl || null,
          logoUpload,
          defaultSubmissionLimit: value.defaultSubmissionLimit,
        },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setIcon(null);
      toast.success("Event settings saved");
      await queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
  });
  const publicPath = `/e/${event.slug}`;

  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Event settings</h1>
        <p className="text-xs text-muted-foreground">
          Identity, schedule, branding, and submission defaults.
        </p>
      </div>
      <form
        className="grid max-w-4xl gap-3"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          void form.handleSubmit();
        }}
      >
        <SettingsSection title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Event name</FieldLabel>
                  <Input
                    id={field.name}
                    className="h-9"
                    required
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="tagline">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Tagline</FieldLabel>
                  <Input
                    id={field.name}
                    className="h-9"
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <Field>
                  <FieldLabel>Event type</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(eventType(value))}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="summit">Summit</SelectItem>
                      <SelectItem value="meetup">Meetup</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <Field>
              <FieldLabel htmlFor="event-slug">Slug</FieldLabel>
              <div className="flex gap-1.5">
                <Input
                  id="event-slug"
                  className="h-9 font-mono text-xs"
                  readOnly
                  value={event.slug}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Copy public event URL"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
                    toast.success("Public URL copied");
                  }}
                >
                  <CopyIcon />
                </Button>
              </div>
              <FieldDescription className="truncate">{publicPath}</FieldDescription>
            </Field>
            <form.Field name="websiteUrl">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Website</FieldLabel>
                  <Input
                    id={field.name}
                    className="h-9"
                    type="url"
                    placeholder="https://example.com"
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="location">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                  <Input
                    id={field.name}
                    className="h-9"
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <RichTextEditor
                    value={field.state.value}
                    placeholder="Describe the event for the public program."
                    onChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Schedule">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="timezone">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Timezone</FieldLabel>
                  <TimezoneCombobox
                    id={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                  <FieldDescription>
                    Changing the timezone only changes how dates are displayed; saved UTC instants
                    do not shift.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.timezone}>
              {(timezone) => (
                <>
                  <form.Field name="startsAt">
                    {(field) => (
                      <Field>
                        <FieldLabel>Starts</FieldLabel>
                        <DateTimePicker
                          value={field.state.value}
                          timezone={timezone}
                          onChange={field.handleChange}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="endsAt">
                    {(field) => (
                      <Field>
                        <FieldLabel>Ends</FieldLabel>
                        <DateTimePicker
                          value={field.state.value}
                          timezone={timezone}
                          onChange={field.handleChange}
                        />
                      </Field>
                    )}
                  </form.Field>
                </>
              )}
            </form.Subscribe>
          </div>
        </SettingsSection>

        <SettingsSection title="Branding">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
            <div className="grid content-start gap-4">
              <Field>
                <FieldLabel>Event icon</FieldLabel>
                <label
                  className={cn(
                    "pressable flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors",
                    dragging && "border-primary bg-primary/5",
                  )}
                  onDragEnter={(dragEvent) => {
                    dragEvent.preventDefault();
                    setDragging(true);
                  }}
                  onDragOver={(dragEvent) => dragEvent.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(dragEvent) => {
                    dragEvent.preventDefault();
                    setDragging(false);
                    chooseIcon(dragEvent.dataTransfer.files[0]);
                  }}
                >
                  <ImageUpIcon className="mb-2 size-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Drop an icon or click to browse</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    PNG, JPG, or SVG · 2 MB max
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(inputEvent) => chooseIcon(inputEvent.target.files?.[0])}
                  />
                </label>
                {icon === null ? null : <FieldDescription>{icon.name}</FieldDescription>}
              </Field>
              <form.Field name="logoUrl">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Remote logo URL</FieldLabel>
                    <Input
                      id={field.name}
                      className="h-9"
                      type="url"
                      placeholder="https://example.com/icon.svg"
                      value={field.state.value}
                      onChange={(inputEvent) => {
                        field.handleChange(inputEvent.target.value);
                        if (icon === null) setPreviewUrl(inputEvent.target.value || null);
                      }}
                    />
                    <FieldDescription>Used when no uploaded icon is selected.</FieldDescription>
                  </Field>
                )}
              </form.Field>
            </div>
            <div className="overflow-hidden rounded-md border">
              <div className="flex h-9 items-center border-b bg-muted/30 px-3 text-xs font-medium">
                True-size previews
              </div>
              <div className="divide-y">
                <PreviewRow label="Sidebar switcher">
                  <EventIcon src={previewUrl} size={32} />
                </PreviewRow>
                <PreviewRow label="Speaker portal">
                  <EventIcon src={previewUrl} size={24} />
                </PreviewRow>
                <div className="grid gap-2 px-3 py-3">
                  <span className="text-[11px] text-muted-foreground">Email header · 48px</span>
                  <div className="rounded-md border bg-background p-3">
                    <div className="flex items-center gap-3 border-b pb-3">
                      <EventIcon src={previewUrl} size={48} />
                      <div>
                        <p className="text-xs font-semibold">{form.state.values.name}</p>
                        <p className="text-[10px] text-muted-foreground">Speaker update</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-4/5 rounded bg-muted" />
                    <div className="mt-2 h-2 w-3/5 rounded bg-muted" />
                  </div>
                </div>
                <PreviewRow label="Public site header">
                  <EventIcon src={previewUrl} size={28} />
                </PreviewRow>
                <PreviewRow label="Favicon">
                  <EventIcon src={previewUrl} size={16} />
                </PreviewRow>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Submissions">
          <form.Field name="defaultSubmissionLimit">
            {(field) => (
              <Field className="max-w-sm">
                <FieldLabel htmlFor={field.name}>Default submission limit</FieldLabel>
                <Input
                  id={field.name}
                  className="h-9"
                  type="number"
                  min={1}
                  step={1}
                  value={field.state.value}
                  onChange={(inputEvent) =>
                    field.handleChange(inputEvent.target.valueAsNumber || 1)
                  }
                />
                <FieldDescription>
                  Gates how many CFP submissions one person can create unless a form overrides it.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
        </SettingsSection>

        <div className="flex justify-end border-t pt-4">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save settings"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </main>
  );
}

function PreviewRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
