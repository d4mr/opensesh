import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CheckSquareIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { speakerPortalQuery } from "@/lib/portal-queries";

const initials = (firstName: string, lastName: string) =>
  `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();

export function PortalHome() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    const key = "opensesh-portal-home-entered";
    if (window.sessionStorage.getItem(key) === null) {
      setEnter(true);
      window.sessionStorage.setItem(key, "1");
    }
  }, []);

  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  const data = portal.data.data;
  const done = data.tasks.filter((item) => item.assignment.status !== "todo").length;
  const next = [...data.tasks]
    .filter((item) => item.assignment.status === "todo" && item.template.dueDate !== null)
    .sort((left, right) => {
      const leftDue = left.template.dueDate;
      const rightDue = right.template.dueDate;
      return leftDue === null || rightDue === null
        ? 0
        : new Date(leftDue).getTime() - new Date(rightDue).getTime();
    })[0];

  return (
    <main className="h-[calc(100svh-3rem)] overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl content-start gap-4 px-4 py-8 md:grid-cols-2">
        <section
          className={`min-w-0 rounded-xl border bg-card ${enter ? "portal-home-card portal-home-card-1" : ""}`}
        >
          <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <CalendarDaysIcon className="size-4" /> My Submissions
            </h2>
            <Link
              to="/portal/$section"
              params={{ section: "submissions" }}
              search={{ spotlight: undefined }}
              className="text-xs font-medium text-primary"
            >
              View all
            </Link>
          </header>
          <div className="divide-y">
            {data.submissions.map(({ submission, format }) => (
              <Link
                key={submission.id}
                to="/portal/$section"
                params={{ section: "submissions" }}
                search={{ spotlight: submission.id }}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="font-mono text-xs tabular-nums">{submission.code}</span>
                    <span className="mx-1.5 text-muted-foreground">—</span>
                    {submission.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format?.name ?? "Format pending"}
                  </p>
                </div>
                <StatusBadge status={submission.status} className="shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        <section
          className={`min-w-0 rounded-xl border bg-card ${enter ? "portal-home-card portal-home-card-2" : ""}`}
        >
          <header className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
            <UserRoundIcon className="size-4" /> My Profile
          </header>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar className="size-11 rounded-md">
              <AvatarImage src={data.contact.headshotUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-md">
                {initials(data.contact.firstName, data.contact.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {data.contact.firstName} {data.contact.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{data.contact.email}</p>
              {data.contact.bio === null ? (
                <Link
                  to="/portal/$section"
                  params={{ section: "profile" }}
                  search={{ spotlight: undefined }}
                  className="mt-0.5 inline-block text-xs font-medium text-primary"
                >
                  Add your bio
                </Link>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">Profile ready</p>
              )}
            </div>
          </div>
        </section>

        <section
          className={`md:col-span-2 min-w-0 rounded-xl border bg-card ${enter ? "portal-home-card portal-home-card-3" : ""}`}
        >
          <header className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
            <CheckSquareIcon className="size-4" /> Tasks
          </header>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-semibold tabular-nums">
                {done} of {data.tasks.length} tasks done
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {next?.template.dueDate === null || next === undefined
                  ? "You are all caught up."
                  : `Next due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: data.event.timezone }).format(new Date(next.template.dueDate))}: ${next.template.title}`}
              </p>
            </div>
            <Link
              to="/portal/$section"
              params={{ section: "tasks" }}
              search={{ spotlight: undefined }}
              className="pressable rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/50"
            >
              Open tasks
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
