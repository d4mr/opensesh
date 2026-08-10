import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui";

const widgets = {
  schedule: {
    label: "Schedule",
    rows: [
      { time: "9:00", title: "Opening keynote", room: "Room A" },
      { time: "10:00", title: "Evals clinic", room: "Room B" },
      { time: "11:00", title: "GPU workshop", room: "Room B" },
    ],
  },
  speakers: {
    label: "Speakers",
    people: [
      { initials: "MC", name: "Maya Chen", org: "Retrieval Labs" },
      { initials: "LH", name: "Lina Haddad", org: "Checkpoint" },
      { initials: "JR", name: "Jamal Reed", org: "Agentdesk" },
    ],
  },
} as const;

type WidgetKind = keyof typeof widgets;

/** Live miniature of the embeddable widgets + the one-tag snippet. */
export function EmbedDemo() {
  const [kind, setKind] = useState<WidgetKind>("schedule");
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="https://opensesh.io/embed.js"\n  data-event="ai-engineer-nyc-2026"\n  data-widget="${kind}"></script>`;

  const copy = () => {
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-10 items-center gap-1 border-b bg-paper px-2">
        {(Object.keys(widgets) as readonly WidgetKind[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={cn(
              "pressable rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              option === kind
                ? "bg-background text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {widgets[option].label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {kind === "schedule" ? (
          <div className="divide-y rounded-lg border">
            {widgets.schedule.rows.map((row) => (
              <div key={row.time} className="flex items-center gap-3 px-3 py-2.5">
                <p className="w-10 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {row.time}
                </p>
                <p className="flex-1 text-sm font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.room}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {widgets.speakers.people.map((person) => (
              <div key={person.initials} className="rounded-lg border px-2 py-3 text-center">
                <span className="mx-auto grid size-9 place-items-center rounded-full bg-status-accepted-bg text-xs font-semibold text-status-accepted">
                  {person.initials}
                </span>
                <p className="mt-2 truncate text-xs font-medium">{person.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{person.org}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t bg-ink p-4">
        <div className="flex items-start justify-between gap-3">
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-foreground">
            {snippet}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-border px-2.5 py-1.5 text-xs font-medium text-ink-foreground transition-colors hover:bg-white/5"
          >
            {copied ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
