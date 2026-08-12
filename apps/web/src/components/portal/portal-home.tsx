import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, CheckSquareIcon, UserRoundCheckIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { speakerPortalQuery } from "@/lib/portal-queries";
import { confirmPortalParticipation } from "@/server-fns/portal";

const initials = (firstName: string, lastName: string) =>
  `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();

export function PortalHome() {
  const portal = useSuspenseQuery(speakerPortalQuery);
  const queryClient = useQueryClient();
  const [enter, setEnter] = useState(false);
  const confirm = useMutation({
    mutationFn: () => confirmPortalParticipation(),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Participation confirmed — see you there!");
      await invalidateAfterMutation(queryClient);
    },
  });

  useEffect(() => {
    const key = "opensesh-portal-home-entered";
    if (window.sessionStorage.getItem(key) === null) {
      setEnter(true);
      window.sessionStorage.setItem(key, "1");
    }
  }, []);

  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  const data = portal.data.data;
  const sessionFiles = data.submissions
    .filter((item) => item.submission.status === "accepted")
    .flatMap((item) =>
      data.requirements.map((requirement) => ({
        submission: item.submission,
        requirement,
        uploaded: data.files.some(
          (file) =>
            file.upload.submissionId === item.submission.id &&
            file.upload.requirementId === requirement.id,
        ),
      })),
    );
  const taskDone = data.tasks.filter((item) => item.assignment.status !== "todo").length;
  const fileDone = sessionFiles.filter((item) => item.uploaded).length;
  const total = data.tasks.length + sessionFiles.length;
  const done = taskDone + fileDone;
  const dueItems = [
    ...data.tasks.flatMap((item) =>
      item.assignment.status === "todo" && item.template.dueDate !== null
        ? [{ due: new Date(item.template.dueDate), title: item.template.title }]
        : [],
    ),
    ...sessionFiles.flatMap((item) =>
      !item.uploaded && item.requirement.dueAt !== null
        ? [
            {
              due: new Date(item.requirement.dueAt),
              title: `${item.requirement.title} · ${item.submission.code}`,
            },
          ]
        : [],
    ),
  ];
  const next = dueItems.sort((left, right) => left.due.getTime() - right.due.getTime())[0];
  const uploadedFileCount = (submissionId: string) =>
    data.requirements.filter((requirement) =>
      data.files.some(
        (item) =>
          item.upload.submissionId === submissionId && item.upload.requirementId === requirement.id,
      ),
    ).length;

  // The acceptance email's "Confirm participation" CTA lands here: shown
  // while the event asks for confirmation and this speaker has an accepted,
  // uncancelled session they have not yet confirmed.
  const needsConfirmation =
    data.event.speakerConfirmationEnabled &&
    data.contact.confirmedAt === null &&
    data.submissions.some(
      (item) => item.submission.status === "accepted" && item.submission.cancelledAt === null,
    );

  return (
    <main className="h-[calc(100svh-3rem)] overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl content-start gap-4 px-4 py-8 md:grid-cols-2">
        {needsConfirmation ? (
          <section className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 md:col-span-2">
            <UserRoundCheckIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Please confirm your participation</p>
              <p className="text-xs text-muted-foreground">
                {data.event.name} is waiting on your confirmation to lock in the program.
              </p>
            </div>
            <Button
              size="sm"
              className="pressable shrink-0"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? "Confirming…" : "Confirm participation"}
            </Button>
          </section>
        ) : null}
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
                    {submission.status !== "accepted" || data.requirements.length === 0
                      ? null
                      : ` · ${uploadedFileCount(submission.id)} of ${data.requirements.length} files uploaded`}
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
                {done} of {total} complete
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {next === undefined
                  ? done === total
                    ? "You are all caught up."
                    : "No upcoming due dates."
                  : `Next due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: data.event.timezone }).format(next.due)}: ${next.title}`}
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
