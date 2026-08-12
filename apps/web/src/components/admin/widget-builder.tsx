import {
  publicDateKey,
  type PublicProgram,
  type Widget,
  type WidgetOptions,
  type WidgetView,
} from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronRightIcon,
  ClipboardIcon,
  Code2Icon,
  FileCode2Icon,
  PlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { EditorHeader } from "@/components/app/editor-header";
import { Timestamp } from "@/components/app/timestamp";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  publicProgramQuery,
  WIDGET_PREVIEW_MESSAGE,
  WIDGET_PREVIEW_READY_MESSAGE,
  widgetsQuery,
} from "@/lib/widget-queries";
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
      timezone={eventContext.event.timezone}
      selectedId={selectedId}
      select={select}
    />
  );
}

function WidgetData({
  eventId,
  eventSlug,
  timezone,
  selectedId,
  select,
}: {
  readonly eventId: string;
  readonly eventSlug: string;
  readonly timezone: string;
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
    return <WidgetEditor key={selected.id} widget={selected} program={program.data.data} />;
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
      <div className="flex shrink-0 items-start justify-between gap-3">
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
      {/* The card hugs its rows — a short list shouldn't drag an empty
          border to the bottom of the viewport. The wrapper keeps scrolling. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {widgets.data.data.length === 0 ? (
          <AdminEmptyState
            className="rounded-lg border bg-card"
            icon={Code2Icon}
            title="Publish your first widget"
            description="Create an embeddable sessions, speakers, or agenda view."
            action={
              <Button
                size="sm"
                className="pressable"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                <PlusIcon /> Add widget
              </Button>
            }
          />
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {widgets.data.data.map((widget) => (
              <WidgetRow
                key={widget.id}
                widget={widget}
                eventId={eventId}
                timezone={timezone}
                onOpen={() => select(widget.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function WidgetRow({
  widget,
  eventId,
  timezone,
  onOpen,
}: {
  readonly widget: Widget;
  readonly eventId: string;
  readonly timezone: string;
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
  // The row must stay a div: nesting the enable Switch (a button) inside a
  // button is invalid HTML and breaks hydration.
  return (
    <div className="flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <button
        type="button"
        onClick={onOpen}
        className="pressable min-w-0 flex-1 text-left"
        aria-label={`Open ${widget.name}`}
      >
        <p className="truncate text-sm font-medium">{widget.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="rounded-md border px-1.5 py-0.5">{labels[widget.view]}</span>
          <span className="ml-2 tabular-nums">
            Updated <Timestamp value={widget.updatedAt} timezone={timezone} mode="date" />
          </span>
        </p>
      </button>
      <Switch
        checked={widget.enabled}
        aria-label={`Enable ${widget.name}`}
        onCheckedChange={(enabled) => save.mutate(enabled)}
      />
      <button
        type="button"
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden
        className="pressable text-muted-foreground"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}

function WidgetEditor({
  widget,
  program,
}: {
  readonly widget: Widget;
  readonly program: PublicProgram;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(widget);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [codeOpen, setCodeOpen] = useState(false);
  const [copied, setCopied] = useState<CopyKey | null>(null);
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
      await queryClient.invalidateQueries({ queryKey: widgetsQuery(widget.eventId).queryKey });
    },
    onError: () => setSaveState("error"),
  });
  // Debounced autosave with an unmount flush: closing the editor within the
  // debounce window must not silently drop the last change.
  const pending = useRef<{ timer: number; draft: Widget } | null>(null);
  const flush = useRef(save.mutate);
  flush.current = save.mutate;
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      pending.current = null;
      save.mutate(draft);
    }, 400);
    pending.current = { timer, draft };
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(
    () => () => {
      if (pending.current !== null) flush.current(pending.current.draft);
    },
    [],
  );
  const updateOptions = <K extends keyof WidgetOptions>(key: K, value: WidgetOptions[K]) =>
    setDraft((current) => ({ ...current, options: { ...current.options, [key]: value } }));
  // The preview iframe stays on one stable URL and receives the live draft via
  // postMessage — no reload per edit (no flicker, no reload races) and no
  // dependence on the autosave round-trip. The embed's ready message covers the
  // case where the frame finishes loading after our first post.
  const frameRef = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const postPreview = () => {
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined) return;
    target.postMessage(
      {
        type: WIDGET_PREVIEW_MESSAGE,
        view: draftRef.current.view,
        name: draftRef.current.name,
        options: draftRef.current.options,
      },
      window.location.origin,
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(postPreview, [draft]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown } | null;
      if (data?.type === WIDGET_PREVIEW_READY_MESSAGE) postPreview();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlSnapshot, setHtmlSnapshot] = useState("");
  // Warm the highlighter while the editor is idle so View HTML opens instantly.
  // Failures are ignored here — the viewer retries and falls back to plain text.
  useEffect(() => {
    loadHighlighter().catch(() => undefined);
  }, []);
  const openHtmlViewer = () => {
    const root = frameRef.current?.contentDocument?.querySelector("main");
    setHtmlSnapshot(root === null || root === undefined ? "" : prettyHtml(root));
    setHtmlOpen(true);
  };
  const outputs = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://opensesh.io" : window.location.origin;
    const params = widgetSearch(draft);
    const url = `${origin}/embed/${widget.id}?${params.toString()}`;
    return {
      url,
      previewUrl: `/embed/${widget.id}?preview=1`,
      iframe: `<iframe src="${url}" title="${draft.name.replaceAll('"', "&quot;")}" width="100%" height="640" style="border:0" loading="lazy"></iframe>`,
      json: `${origin}/embed/${widget.id}/json`,
      ics: `${origin}/embed/${widget.id}/ics`,
    };
  }, [draft, widget.id]);
  return (
    <main className="flex h-[calc(100svh-var(--header-height)-1rem)] min-h-0 flex-col">
      <EditorHeader
        backTo="/admin/widgets"
        backLabel="Widgets"
        title={draft.name}
        subtitle={
          <span aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save" : "Saved"}
          </span>
        }
      >
        <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="pressable">
              <Code2Icon /> Get code
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Embed this widget</DialogTitle>
              <DialogDescription>
                Both outputs use live published data — no rebuilds needed after program changes.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <OutputRow
                label="Share URL"
                value={outputs.url}
                copied={copied === "url"}
                onCopy={() => void copyOutput(outputs.url, "url", setCopied)}
              />
              <OutputRow
                label="Iframe snippet"
                value={outputs.iframe}
                copied={copied === "iframe"}
                onCopy={() => void copyOutput(outputs.iframe, "iframe", setCopied)}
              />
              <OutputRow
                label="JSON feed"
                value={outputs.json}
                copied={copied === "json"}
                onCopy={() => void copyOutput(outputs.json, "json", setCopied)}
              />
              <OutputRow
                label="Calendar (ICS)"
                value={outputs.ics}
                copied={copied === "ics"}
                onCopy={() => void copyOutput(outputs.ics, "ics", setCopied)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </EditorHeader>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
        <div className="grid min-w-0 content-start gap-5 overflow-y-auto border-r p-4">
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
              <SelectTrigger size="sm" className="w-full">
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
              label="Days"
              items={programDays(program)}
              selected={draft.options.dayKeys}
              update={(value) => updateOptions("dayKeys", value)}
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
                <SelectTrigger size="sm" className="w-full">
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
                <SelectTrigger size="sm" className="w-full">
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
          <Field label="Custom CSS">
            <Textarea
              value={draft.options.customCss ?? ""}
              onChange={(event) => updateOptions("customCss", event.target.value)}
              spellCheck={false}
              rows={8}
              placeholder={".os-session-title { text-transform: uppercase; }"}
              className="min-h-32 font-mono text-xs"
              aria-label="Custom CSS"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Applied inside the embed only. Stable hooks:{" "}
              {cssHooks.map((hook, index) => (
                <span key={hook}>
                  {index === 0 ? "" : ", "}
                  <code className="rounded bg-muted px-1 py-px">{hook}</code>
                </span>
              ))}
              . Use <span className="font-medium text-foreground">View HTML</span> in the preview to
              inspect the full markup.
            </p>
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
        <div className="flex min-h-0 min-w-0 flex-col bg-muted/30 p-4">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Live preview
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="pressable h-6 px-2 text-[11px] text-muted-foreground"
                onClick={openHtmlViewer}
              >
                <FileCode2Icon className="size-3" /> View HTML
              </Button>
              <p className="text-[11px] text-muted-foreground">Updates live</p>
            </div>
          </div>
          <iframe
            ref={frameRef}
            src={outputs.previewUrl}
            title={`${draft.name} preview`}
            onLoad={postPreview}
            className="min-h-0 w-full flex-1 rounded-lg border bg-background"
          />
        </div>
      </div>
      <HtmlViewerDialog open={htmlOpen} onOpenChange={setHtmlOpen} source={htmlSnapshot} />
    </main>
  );
}

const cssHooks = [
  ".embed-root",
  ".os-list",
  ".os-session",
  ".os-session-title",
  ".os-session-meta",
  ".os-session-description",
  ".os-track-chip",
  ".os-format-chip",
  ".os-speaker",
  ".os-speaker-card",
  ".os-speaker-name",
  ".os-headshot",
  ".os-gallery",
  ".os-agenda-slot",
  ".os-day-heading",
];

// Serializes the live preview DOM into readable, indented HTML. Head-only
// noise (style/script) is dropped and svg icon internals are collapsed so the
// output stays focused on selectable structure.
const prettyHtml = (root: Element) => {
  const voidTags = new Set(["img", "br", "hr", "input"]);
  const lines: Array<string> = [];
  const walk = (node: Node, depth: number) => {
    if (lines.length > 4000) return;
    const pad = "  ".repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (text !== undefined && text !== "") lines.push(pad + text);
      return;
    }
    // nodeType, not instanceof: these nodes come from the preview iframe's
    // realm, whose Element constructor is not this window's Element.
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === "style" || tag === "script" || tag === "link" || tag === "meta") return;
    const attrs = Array.from(element.attributes)
      .map((attribute) => `${attribute.name}="${attribute.value}"`)
      .join(" ");
    const open = `<${tag}${attrs === "" ? "" : ` ${attrs}`}`;
    if (tag === "svg") {
      lines.push(`${pad}${open}>…</svg>`);
      return;
    }
    if (voidTags.has(tag)) {
      lines.push(`${pad}${open} />`);
      return;
    }
    lines.push(`${pad}${open}>`);
    node.childNodes.forEach((child) => walk(child, depth + 1));
    lines.push(`${pad}</${tag}>`);
  };
  walk(root, 0);
  return lines.join("\n");
};

let highlighterPromise: Promise<typeof import("shiki/bundle/web")> | null = null;
// A failed import (dev-server dep re-optimization, flaky network) must not be
// cached, or every later open would hang on the same dead promise.
const loadHighlighter = () => {
  highlighterPromise ??= import("shiki/bundle/web").catch((error: unknown) => {
    highlighterPromise = null;
    throw error;
  });
  return highlighterPromise;
};

// A dynamic import() exposes no progress events, so downloaded bytes are read
// from the browser's resource timing entries for the highlighter's chunks and
// shown against the bundle's approximate built size. Cached loads report zero
// bytes and resolve immediately, so the bar barely appears.
const HIGHLIGHTER_APPROX_BYTES = 1_200_000;
const formatBytesShort = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.round(value / 1000)} KB`;

const useHighlighterProgress = (active: boolean) => {
  const [bytes, setBytes] = useState(0);
  useEffect(() => {
    if (!active) return;
    const seen = new Set<string>();
    let total = 0;
    const record = (entries: ReadonlyArray<PerformanceEntry>) => {
      for (const entry of entries) {
        if (!(entry instanceof PerformanceResourceTiming)) continue;
        if (!/shiki|oniguruma/i.test(entry.name) || seen.has(entry.name)) continue;
        seen.add(entry.name);
        total += entry.transferSize || entry.encodedBodySize;
      }
      setBytes(total);
    };
    record(performance.getEntriesByType("resource"));
    const observer = new PerformanceObserver((list) => record(list.getEntries()));
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, [active]);
  return bytes;
};

function HtmlViewerDialog({
  open,
  onOpenChange,
  source,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly source: string;
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const highlighting = open && source !== "" && highlighted === null && !failed;
  const downloadedBytes = useHighlighterProgress(highlighting);
  useEffect(() => {
    if (!open || source === "") return;
    let cancelled = false;
    setHighlighted(null);
    setFailed(false);
    loadHighlighter()
      .then(async ({ codeToHtml }) => {
        const result = await codeToHtml(source, {
          lang: "html",
          themes: { light: "github-light", dark: "github-dark" },
        });
        if (!cancelled) setHighlighted(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source, attempt]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base">Rendered HTML</DialogTitle>
          <DialogDescription className="text-xs">
            The live preview's current markup — target any class here from Custom CSS.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 pt-3 pb-5">
          <div className="flex h-6 shrink-0 items-center justify-between gap-3">
            <div
              className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {highlighting ? (
                <>
                  <span className="tabular-nums">
                    Highlighting — {formatBytesShort(downloadedBytes)} of ~
                    {formatBytesShort(HIGHLIGHTER_APPROX_BYTES)}
                  </span>
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${Math.round(Math.min(downloadedBytes / HIGHLIGHTER_APPROX_BYTES, 0.97) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              ) : failed ? (
                <>
                  <span>Highlighter unavailable — showing plain text.</span>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="pressable h-5 px-1.5 text-[11px]"
                    onClick={() => setAttempt((current) => current + 1)}
                  >
                    Retry
                  </Button>
                </>
              ) : null}
            </div>
            <Button
              size="xs"
              variant="outline"
              className="pressable shrink-0"
              disabled={source === ""}
              onClick={() => {
                void navigator.clipboard.writeText(source);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <CheckIcon /> : <ClipboardIcon />}
              {copied ? "Copied" : "Copy HTML"}
            </Button>
          </div>
          <div className="shiki-viewer min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 text-xs">
            {source === "" ? (
              <p className="p-4 text-xs text-muted-foreground">
                Couldn't read the preview markup — close this and try again once the preview has
                loaded.
              </p>
            ) : highlighted === null ? (
              <pre className="p-3 font-mono leading-relaxed">{source}</pre>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: highlighted }} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutputRow({
  label,
  value,
  copied,
  onCopy,
}: {
  readonly label: string;
  readonly value: string;
  readonly copied: boolean;
  readonly onCopy: () => void;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[110px_1fr_auto] sm:items-center">
      <span className="text-xs font-medium">{label}</span>
      <code className="min-w-0 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 text-xs">
        {value}
      </code>
      <Button size="sm" variant="outline" className="pressable shrink-0" onClick={onCopy}>
        {copied ? <CheckIcon /> : <ClipboardIcon />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

type CopyKey = "url" | "iframe" | "json" | "ics";

const copyOutput = async (
  value: string,
  key: CopyKey,
  setCopied: (value: CopyKey | null) => void,
) => {
  await navigator.clipboard.writeText(value);
  setCopied(key);
  window.setTimeout(() => setCopied(null), 1500);
};

const widgetSearch = (widget: Widget) => {
  const params = new URLSearchParams();
  const option = widget.options;
  params.set("view", widget.view);
  params.set("theme", option.theme);
  params.set("color", option.primaryColor ?? "default");
  params.set("time", option.dateFormat);
  params.set("tracks", option.trackIds.join(","));
  params.set("formats", option.formatIds.join(","));
  params.set("days", option.dayKeys.join(","));
  params.set("tags", option.tagIds.join(","));
  params.set("company", option.showSpeakerCompany ? "1" : "0");
  params.set("title", option.showSpeakerTitle ? "1" : "0");
  params.set("bio", option.showSpeakerBio ? "1" : "0");
  params.set("description", option.showSessionDescription ? "1" : "0");
  params.set("level", option.showSessionLevel ? "1" : "0");
  params.set("format", option.showSessionFormat ? "1" : "0");
  params.set("calendar", option.showAddToCalendar ? "1" : "0");
  return params;
};

const programDays = (program: PublicProgram) =>
  Array.from(
    new Map(
      program.sessions.map((session) => {
        const id = publicDateKey(session.startsAt, program.event.timezone);
        const name = new Intl.DateTimeFormat("en-US", {
          timeZone: program.event.timezone,
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(new Date(session.startsAt));
        return [id, { id, name }] as const;
      }),
    ).values(),
  );

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
