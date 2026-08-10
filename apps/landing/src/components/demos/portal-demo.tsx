import { CircleCheckIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui";

const initialTasks = [
  { id: "details", label: "Confirm session details", done: true },
  { id: "headshot", label: "Upload a headshot", done: false },
  { id: "slides", label: "Upload draft slides", done: false },
];

/** Live miniature of the speaker portal task list. */
export function PortalDemo() {
  const [tasks, setTasks] = useState(initialTasks);
  const doneCount = tasks.filter((task) => task.done).length;
  const allDone = doneCount === tasks.length;

  const toggle = (id: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  };

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-10 items-center justify-between border-b bg-paper px-4">
        <p className="text-[13px] font-medium">Welcome back, Maya</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {doneCount} of {tasks.length} done
        </p>
      </div>
      <div className="p-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => toggle(task.id)}
            className={cn(
              "pressable flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-paper",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors",
                task.done ? "border-primary bg-primary" : "border-border",
              )}
            >
              {task.done ? <CircleCheckIcon className="size-3.5 text-primary-foreground" /> : null}
            </span>
            <span
              className={cn(
                "text-sm transition-colors",
                task.done && "text-muted-foreground line-through decoration-border",
              )}
            >
              {task.label}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t bg-paper px-4 py-3">
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(doneCount / tasks.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {allDone
            ? "Profile complete. The organizer sees it instantly."
            : "Progress shows up on the organizer's dashboard in real time."}
        </p>
      </div>
    </div>
  );
}
