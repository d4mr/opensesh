import type { PublicProgram, Widget, WidgetOptions, WidgetView } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronRightIcon, ClipboardIcon, Code2Icon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAdminEvent } from "@/components/app/admin-event-context";
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
import { cn } from "@/lib/utils";
import { publicProgramQuery, widgetsQuery } from "@/lib/widget-queries";
import { createWidget, listWidgets, saveWidget } from "@/server-fns/widgets";

type WidgetListResult = Awaited<ReturnType<typeof listWidgets>>;

const labels: Readonly<Record<WidgetView, string>> = {
  sessions: "Sessions",
  speakers: "Speaker list",
  speaker_gallery: "Speaker gallery",
  agenda: "Agenda",
  itinerary: "Itinerary",
};
const views = Object.entries(labels)
  .map(([value, label]) => ({ value, label }))
  .filter((item): item is { value: WidgetView; label: string } => item.value in labels);

export function WidgetBuilder({
  selectedId,
  select,
}: {
  readonly selectedId?: string;
  readonly select: (id?: string) => void;
}) {
  const eventContext = useAdminEvent();
  if (eventContext === null) return null;
  return (
    <WidgetData
      eventId={eventContext.event.id}
      eventSlug={eventContext.event.slug}
      selectedId={selectedId}
      select={select}
    />
  );
}

function WidgetData({
  eventId,
  eventSlug,
  selectedId,
  select,
}: {
  readonly eventId: string;
  readonly eventSlug: string;
  readonly selectedId?: string;
  readonly select: (id?: string) => void;
}) {
  const queryClient = useQueryClient();
  const listOptions = widgetsQuery(eventId);
  const programOptions = publicProgramQuery(eventSlug);
  const widgets = useSuspenseQuery(listOptions);
  const program = useSuspenseQuery(programOptions);
  const create = useMutation({
    mutationFn: () =>
      createWidget({ data: { eventId, name: "Untitled widget", view: "sessions" } }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
      select(result.data.id);
    },
  });
  if (!widgets.data.ok) return <p className="p-6 text-sm">{widgets.data.error.message}</p>;
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  const selected = widgets.data.data.find((widget) => widget.id === selectedId);
  if (selected !== undefined)
    return (
      <WidgetEditor
        key={selected.id}
        widget={selected}
        program={program.data.data}
        close={() => select()}
      />
    );
  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Widgets</h1>
          <p className="text-xs text-muted-foreground">
            Publish focused program views with live data and no cache delay.
          </p>
        </div>
        <Button
          size="sm"
          className="pressable"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          <PlusIcon /> Add widget
        </Button>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {widgets.data.data.length === 0 ? (
          <div className="py-12 text-center">
            <Code2Icon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No widgets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add one to embed a public program view.
            </p>
          </div>
        ) : (
          widgets.data.data.map((widget) => (
            <WidgetRow
              key={widget.id}
              widget={widget}
              eventId={eventId}
              onOpen={() => select(widget.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}

function WidgetRow({
  widget,
  eventId,
  onOpen,
}: {
  readonly widget: Widget;
  readonly eventId: string;
  readonly onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (enabled: boolean) =>
      saveWidget({
        data: {
          id: widget.id,
          eventId,
          name: widget.name,
          view: widget.view,
          enabled,
          options: widget.options,
        },
      }),
    onMutate: async (enabled) => {
      const options = widgetsQuery(eventId);
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      queryClient.setQueryData<WidgetListResult>(options.queryKey, (current) =>
        current?.ok
          ? {
              ok: true,
              data: current.data.map((item) =>
                item.id === widget.id ? { ...item, enabled } : item,
              ),
            }
          : current,
      );
    },
    onSettled: async () =>
      queryClient.invalidateQueries({ queryKey: widgetsQuery(eventId).queryKey }),
  });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{widget.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="rounded-md border px-1.5 py-0.5">{labels[widget.view]}</span>
          <span className="ml-2 tabular-nums">
            Updated{" "}
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
              new Date(widget.updatedAt),
            )}
          </span>
        </p>
      </div>
      <Switch
        checked={widget.enabled}
        aria-label={`Enable ${widget.name}`}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(enabled) => save.mutate(enabled)}
      />
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </button>
  );
}

function WidgetEditor({
  widget,
  program,
  close,
}: {
  readonly widget: Widget;
  readonly program: PublicProgram;
  readonly close: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(widget);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [preview, setPreview] = useState(0);
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initial = useRef(true);
  const save = useMutation({
    mutationFn: (value: Widget) =>
      saveWidget({
        data: {
          id: value.id,
          eventId: value.eventId,
          name: value.name,
          view: value.view,
          enabled: value.enabled,
          options: value.options,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setPreview((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: widgetsQuery(widget.eventId).queryKey });
    },
    onError: () => setSaveState("error"),
  });
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => save.mutate(draft), 400);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const updateOptions = <K extends keyof WidgetOptions>(key: K, value: WidgetOptions[K]) =>
    setDraft((current) => ({ ...current, options: { ...current.options, [key]: value } }));
  const code = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://opensesh.io" : window.location.origin;
    return `<iframe src="${origin}/embed/${widget.id}" title="${draft.name.replaceAll('"', "&quot;")}" width="100%" height="640" style="border:0" loading="lazy"></iframe>`;
  }, [draft.name, widget.id]);
  return (
    <main className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
      <div className="flex h-11 items-center gap-2 border-b px-4">
        <Button size="sm" variant="ghost" className="pressable -ml-2" onClick={close}>
          Widgets
        </Button>
        <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        <p className="truncate text-sm font-medium">{draft.name}</p>
        <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save" : "Saved"}
        </p>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-5 overflow-y-auto border-r p-4">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="h-8"
            />
          </Field>
          <Field label="View">
            <Select
              value={draft.view}
              onValueChange={(value: WidgetView) => setDraft({ ...draft, view: value })}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {views.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Filters">
            <FilterOptions
              label="Tracks"
              items={program.tracks}
              selected={draft.options.trackIds}
              update={(value) => updateOptions("trackIds", value)}
            />
            <FilterOptions
              label="Formats"
              items={program.formats}
              selected={draft.options.formatIds}
              update={(value) => updateOptions("formatIds", value)}
            />
            <FilterOptions
              label="Tags"
              items={program.tags}
              selected={draft.options.tagIds}
              update={(value) => updateOptions("tagIds", value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Theme">
              <Select
                value={draft.options.theme}
                onValueChange={(value: "light" | "dark" | "auto") => updateOptions("theme", value)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time">
              <Select
                value={draft.options.dateFormat}
                onValueChange={(value: "12h" | "24h") => updateOptions("dateFormat", value)}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12 hour</SelectItem>
                  <SelectItem value="24h">24 hour</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Primary color">
            <div className="flex gap-2">
              {draft.options.primaryColor === null ? (
                <input
                  type="color"
                  aria-label="Choose primary color"
                  onChange={(event) => updateOptions("primaryColor", event.target.value)}
                  className="h-8 w-10 rounded border bg-background p-1"
                />
              ) : (
                <input
                  type="color"
                  aria-label="Choose primary color"
                  value={draft.options.primaryColor}
                  onChange={(event) => updateOptions("primaryColor", event.target.value)}
                  className="h-8 w-10 rounded border bg-background p-1"
                />
              )}
              <Input
                value={draft.options.primaryColor ?? ""}
                onChange={(event) => updateOptions("primaryColor", event.target.value || null)}
                placeholder="Theme default"
                className="h-8"
              />
            </div>
          </Field>
          <Field label="Visible fields">
            <Toggle
              label="Speaker company"
              checked={draft.options.showSpeakerCompany}
              update={(value) => updateOptions("showSpeakerCompany", value)}
            />
            <Toggle
              label="Speaker title"
              checked={draft.options.showSpeakerTitle}
              update={(value) => updateOptions("showSpeakerTitle", value)}
            />
            <Toggle
              label="Speaker bio"
              checked={draft.options.showSpeakerBio}
              update={(value) => updateOptions("showSpeakerBio", value)}
            />
            <Toggle
              label="Session description"
              checked={draft.options.showSessionDescription}
              update={(value) => updateOptions("showSessionDescription", value)}
            />
            <Toggle
              label="Session level"
              checked={draft.options.showSessionLevel}
              update={(value) => updateOptions("showSessionLevel", value)}
            />
            <Toggle
              label="Session format"
              checked={draft.options.showSessionFormat}
              update={(value) => updateOptions("showSessionFormat", value)}
            />
            <Toggle
              label="Add to calendar"
              checked={draft.options.showAddToCalendar}
              update={(value) => updateOptions("showAddToCalendar", value)}
            />
          </Field>
          <div className="flex items-center justify-between border-t pt-4">
            <Label htmlFor="widget-enabled" className="text-xs">
              Widget enabled
            </Label>
            <Switch
              id="widget-enabled"
              checked={draft.enabled}
              onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
            />
          </div>
        </div>
        <div className="min-h-[560px] bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Live preview
            </p>
            <p className="text-[11px] text-muted-foreground">Updates after save</p>
          </div>
          <iframe
            key={preview}
            src={`/embed/${widget.id}?preview=${preview}`}
            title={`${draft.name} preview`}
            className="h-[calc(100%-24px)] min-h-[520px] w-full rounded-lg border bg-background"
          />
        </div>
      </div>
      <footer className="border-t bg-background p-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Embed changes use live published data immediately.
          </p>
          <Button size="sm" className="pressable" onClick={() => setCodeOpen((value) => !value)}>
            <Code2Icon /> Get code
          </Button>
        </div>
        {codeOpen ? (
          <div className="mx-auto mt-3 flex max-w-5xl items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 text-xs">
              {code}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="pressable shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckIcon /> : <ClipboardIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <span className="w-12 text-xs text-muted-foreground" aria-live="polite">
              {copied ? "Copied" : ""}
            </span>
          </div>
        ) : null}
      </footer>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Toggle({
  label,
  checked,
  update,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly update: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-muted/60">
      <Checkbox checked={checked} onCheckedChange={(value) => update(value === true)} />
      {label}
    </label>
  );
}
function FilterOptions({
  label,
  items,
  selected,
  update,
}: {
  readonly label: string;
  readonly items: ReadonlyArray<{ id: string; name: string }>;
  readonly selected: ReadonlyArray<string>;
  readonly update: (value: ReadonlyArray<string>) => void;
}) {
  return (
    <div className="rounded-lg border p-1.5">
      <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      {items.map((item) => (
        <label
          key={item.id}
          className={cn(
            "flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors",
            selected.includes(item.id) ? "bg-muted" : "hover:bg-muted/60",
          )}
        >
          <Checkbox
            checked={selected.includes(item.id)}
            onCheckedChange={(checked) =>
              update(
                checked === true ? [...selected, item.id] : selected.filter((id) => id !== item.id),
              )
            }
          />
          {item.name}
        </label>
      ))}
    </div>
  );
}
