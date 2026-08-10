import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleCheckIcon, CircleDashedIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/app/status-badge";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { adminPortalQuery } from "@/lib/portal-queries";
import type { getPortalAdmin } from "@/server-fns/portal";

type AdminData = Extract<Awaited<ReturnType<typeof getPortalAdmin>>, { readonly ok: true }>["data"];
type SpeakerContact = AdminData["participants"][number]["contact"];

const dietaryLabels: Readonly<Record<string, string>> = {
  none: "—",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  other: "Other",
};

type ReadinessFilter = "all" | "missing-bio" | "missing-headshot";

const filters: ReadonlyArray<{ readonly value: ReadinessFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "missing-bio", label: "Missing bio" },
  { value: "missing-headshot", label: "Missing headshot" },
];

export function SpeakersDirectory() {
  const eventContext = useAdminEvent();
  if (eventContext === null) return null;
  return <SpeakersData eventId={eventContext.event.id} />;
}

function SpeakersData({ eventId }: { readonly eventId: string }) {
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  return <Directory data={portal.data.data} />;
}

function Directory({ data }: { readonly data: AdminData }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReadinessFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const speakers = Array.from(
    new Map(data.participants.map((row) => [row.contact.id, row.contact])).values(),
  )
    .map((contact) => {
      const sessions = data.participants
        .filter((row) => row.contact.id === contact.id)
        .map((row) => row.submission);
      const hasHeadshot =
        contact.headshotUrl !== null ||
        data.files.some((row) => row.contact.id === contact.id && row.upload.kind === "headshot");
      const outstanding = data.assignments.filter(
        (row) =>
          row.assignment.status === "todo" &&
          (row.assignment.contactId === contact.id ||
            (row.assignment.submissionId !== null &&
              sessions.some((session) => session.id === row.assignment.submissionId))),
      ).length;
      return { contact, sessions, hasHeadshot, outstanding };
    })
    .filter((row) => {
      if (filter === "missing-bio" && row.contact.bio !== null && row.contact.bio.length > 0)
        return false;
      if (filter === "missing-headshot" && row.hasHeadshot) return false;
      const query = search.trim().toLowerCase();
      if (query.length === 0) return true;
      return [
        row.contact.firstName,
        row.contact.lastName,
        row.contact.email,
        row.contact.company ?? "",
        ...row.sessions.map((session) => session.title),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => left.contact.lastName.localeCompare(right.contact.lastName));

  const selected = speakers.find((row) => row.contact.id === selectedId);

  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-semibold">Speakers</h1>
        <p className="text-xs text-muted-foreground">
          Everyone attached to a submission — readiness, profile, and sessions.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search speakers…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-1" role="group">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "pressable rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                filter === item.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-xs text-muted-foreground tabular-nums">
          {speakers.length} speaker{speakers.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Speaker</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Dietary</TableHead>
              <TableHead>T-shirt</TableHead>
              <TableHead>Ready</TableHead>
              <TableHead className="w-10" aria-label="Open" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {speakers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No speakers match.
                </TableCell>
              </TableRow>
            ) : (
              speakers.map((row) => (
                <TableRow
                  key={row.contact.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(row.contact.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Headshot contact={row.contact} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {row.contact.firstName} {row.contact.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[row.contact.title, row.contact.company].filter(Boolean).join(" · ") ||
                            row.contact.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs tabular-nums">
                      {row.sessions.map((session) => session.code).join(", ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {dietaryLabels[row.contact.dietaryRequirements] ??
                      row.contact.dietaryRequirements}
                  </TableCell>
                  <TableCell className="text-xs">{row.contact.tshirtSize ?? "—"}</TableCell>
                  <TableCell>
                    {row.outstanding === 0 &&
                    row.hasHeadshot &&
                    row.contact.bio !== null &&
                    row.contact.bio.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--status-accepted)]">
                        <CircleCheckIcon className="size-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleDashedIcon className="size-3.5" />
                        {row.outstanding > 0
                          ? `${row.outstanding} task${row.outstanding === 1 ? "" : "s"}`
                          : row.contact.bio === null || row.contact.bio.length === 0
                            ? "Bio missing"
                            : "Headshot missing"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected === undefined ? null : (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Headshot contact={selected.contact} size="lg" />
                  <div className="min-w-0">
                    <SheetTitle>
                      {selected.contact.firstName} {selected.contact.lastName}
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {[selected.contact.title, selected.contact.company]
                        .filter(Boolean)
                        .join(" · ") || selected.contact.email}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-4">
                <section className="grid gap-1 text-xs">
                  <h3 className="font-medium text-muted-foreground">Contact</h3>
                  <p>{selected.contact.email}</p>
                  {selected.contact.phone === null ? null : <p>{selected.contact.phone}</p>}
                  <p className="text-muted-foreground">
                    {[
                      dietaryLabels[selected.contact.dietaryRequirements] === "—"
                        ? "No dietary needs"
                        : (dietaryLabels[selected.contact.dietaryRequirements] ??
                          selected.contact.dietaryRequirements),
                      selected.contact.tshirtSize === null
                        ? null
                        : `T-shirt ${selected.contact.tshirtSize}`,
                      selected.contact.pronouns,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {selected.contact.linkedinUrl === null ? null : (
                      <SocialLink href={selected.contact.linkedinUrl} label="LinkedIn" />
                    )}
                    {selected.contact.twitterUrl === null ? null : (
                      <SocialLink href={selected.contact.twitterUrl} label="Twitter" />
                    )}
                    {selected.contact.websiteUrl === null ? null : (
                      <SocialLink href={selected.contact.websiteUrl} label="Website" />
                    )}
                  </div>
                </section>
                <section className="grid gap-1 text-xs">
                  <h3 className="font-medium text-muted-foreground">Bio</h3>
                  {selected.contact.bio === null || selected.contact.bio.length === 0 ? (
                    <p className="italic text-muted-foreground/70">No bio yet.</p>
                  ) : (
                    <div
                      className="leading-relaxed text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: selected.contact.bio }}
                    />
                  )}
                </section>
                <section className="grid gap-2 text-xs">
                  <h3 className="font-medium text-muted-foreground">Sessions</h3>
                  {selected.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <p className="min-w-0 truncate">
                        <span className="font-mono tabular-nums">{session.code}</span> —{" "}
                        <span className="font-medium">{session.title}</span>
                      </p>
                      <StatusBadge status={session.status} />
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Headshot({
  contact,
  size = "sm",
}: {
  readonly contact: SpeakerContact;
  readonly size?: "sm" | "lg";
}) {
  const classes = size === "lg" ? "size-12 rounded-md text-sm" : "size-8 rounded-md text-xs";
  return contact.headshotUrl === null ? (
    <div
      className={cn("flex shrink-0 items-center justify-center bg-muted font-semibold", classes)}
    >
      {contact.firstName[0]}
      {contact.lastName[0]}
    </div>
  ) : (
    <img src={contact.headshotUrl} alt="" className={cn("shrink-0 object-cover", classes)} />
  );
}

function SocialLink({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="pressable inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {label}
    </a>
  );
}
