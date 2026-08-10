import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CheckSquareIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="mx-auto grid max-w-5xl gap-3 px-4 py-5 md:grid-cols-2">
      <Card className={enter ? "portal-home-card portal-home-card-1" : undefined}>
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4" /> My Submissions
            </span>
            <Link
              to="/portal/$section"
              params={{ section: "submissions" }}
              search={{ spotlight: undefined }}
              className="text-xs text-primary"
            >
              View all
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {data.submissions.map(({ submission, format }) => (
            <div key={submission.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  <span className="font-mono tabular-nums">{submission.code}</span> —{" "}
                  {submission.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format?.name ?? "Format pending"}
                </p>
              </div>
              <StatusBadge status={submission.status} className="shrink-0 px-2 py-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={enter ? "portal-home-card portal-home-card-2" : undefined}>
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserRoundIcon className="size-4" /> My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 py-4">
          <Avatar className="size-12 rounded-md">
            <AvatarImage src={data.contact.headshotUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-md">
              {initials(data.contact.firstName, data.contact.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {data.contact.firstName} {data.contact.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{data.contact.email}</p>
            {data.contact.bio === null ? (
              <Link
                to="/portal/$section"
                params={{ section: "profile" }}
                search={{ spotlight: undefined }}
                className="mt-1 inline-block text-xs font-medium text-primary"
              >
                Add your bio
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Profile ready</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={`md:col-span-2 ${enter ? "portal-home-card portal-home-card-3" : ""}`}>
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckSquareIcon className="size-4" /> Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {done} of {data.tasks.length} tasks done
            </p>
            <p className="text-xs text-muted-foreground">
              {next?.template.dueDate === null || next === undefined
                ? "You are all caught up."
                : `Next due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(next.template.dueDate))}: ${next.template.title}`}
            </p>
          </div>
          <Link
            to="/portal/$section"
            params={{ section: "tasks" }}
            search={{ spotlight: undefined }}
            className="pressable rounded-md border px-3 py-1.5 text-xs font-medium"
          >
            Open tasks
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
