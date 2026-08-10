import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui";

const formats = ["Talk", "Workshop", "Panel"] as const;
type Format = (typeof formats)[number];

const tracks = [
  { name: "Agents", reviewers: 3 },
  { name: "Infra & GPUs", reviewers: 2 },
  { name: "Evals", reviewers: 4 },
] as const;

/** Live miniature of the CFP form builder: conditional questions + track routing. */
export function FormDemo() {
  const [format, setFormat] = useState<Format>("Talk");
  const [track, setTrack] = useState(0);

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-10 items-center justify-between border-b bg-paper px-4">
        <p className="text-[13px] font-medium">Call for speakers</p>
        <p className="text-xs text-muted-foreground">Try it — it's live</p>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-medium">Session format</p>
          <div className="mt-2 inline-flex rounded-md border p-0.5">
            {formats.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFormat(option)}
                className={cn(
                  "pressable rounded-[5px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                  option === format
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn("conditional", format === "Workshop" && "is-open")}
          aria-hidden={format !== "Workshop"}
        >
          <div>
            <label className="text-xs font-medium" htmlFor="demo-capacity">
              Workshop capacity
            </label>
            <input
              id="demo-capacity"
              type="number"
              defaultValue={40}
              tabIndex={format === "Workshop" ? 0 : -1}
              className="mt-2 h-9 w-32 rounded-md border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary"
            />
            <p className="mt-1.5 pb-1 text-xs text-muted-foreground">
              This question only exists because you picked Workshop.
            </p>
          </div>
        </div>

        <div
          className={cn("conditional", format === "Panel" && "is-open")}
          aria-hidden={format !== "Panel"}
        >
          <div>
            <label className="text-xs font-medium" htmlFor="demo-panelists">
              Co-panelists
            </label>
            <input
              id="demo-panelists"
              type="text"
              placeholder="Up to 3 names"
              tabIndex={format === "Panel" ? 0 : -1}
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
            />
            <p className="mt-1.5 pb-1 text-xs text-muted-foreground">
              Panels ask for panelists. Talks never see this field.
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium">Track</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tracks.map((option, index) => (
              <button
                key={option.name}
                type="button"
                onClick={() => setTrack(index)}
                className={cn(
                  "pressable rounded-full border px-3 py-1 text-[13px] transition-colors",
                  index === track
                    ? "border-primary bg-status-accepted-bg text-status-accepted"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex h-11 items-center gap-1.5 border-t bg-paper px-4 text-xs text-muted-foreground">
        <ArrowRightIcon className="size-3.5 text-primary" aria-hidden="true" />
        Routes to the{" "}
        <span className="font-medium text-foreground">
          {tracks[track].reviewers} {tracks[track].name}
        </span>{" "}
        reviewers on submit.
      </div>
    </div>
  );
}
