import type { SpeakerCsvRow, SpeakerDirectoryRow } from "@opensesh/domain";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { speakerDirectoryQuery } from "@/lib/widget-queries";
import { importSpeakerCsv } from "@/server-fns/widgets";

const dietaryLabels: Readonly<Record<string, string>> = {
  none: "—",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  other: "Other",
};

export function SpeakersDirectory() {
  const context = useAdminEvent();
  if (context === null) return null;
  return <DirectoryData eventId={context.event.id} />;
}

function DirectoryData({ eventId }: { readonly eventId: string }) {
  const result = useSuspenseQuery(speakerDirectoryQuery(eventId));
  if (!result.data.ok) return <p className="p-6 text-sm">{result.data.error.message}</p>;
  return <Directory eventId={eventId} rows={result.data.data.rows} csv={result.data.data.csv} />;
}

function Directory({
  eventId,
  rows,
  csv,
}: {
  readonly eventId: string;
  readonly rows: ReadonlyArray<SpeakerDirectoryRow>;
  readonly csv: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        [
          row.contact.firstName,
          row.contact.lastName,
          row.contact.email,
          row.contact.company ?? "",
          ...row.sessions.map((session) => session.title),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );
  const selected = rows.find((row) => row.contact.id === selectedId);
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "speakers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Speakers</h1>
          <p className="text-xs text-muted-foreground">
            The event directory, profile readiness, and session links.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="pressable" onClick={download}>
            <DownloadIcon /> Export CSV
          </Button>
          <Button size="sm" className="pressable" onClick={() => setImportOpen(true)}>
            <UploadIcon /> Import CSV
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search speakers…"
            className="h-8 pl-8"
          />
        </div>
        <p className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} speaker{filtered.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Speaker</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Dietary</TableHead>
              <TableHead>T-shirt</TableHead>
              <TableHead>Social</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No speakers match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.contact.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(row.contact.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Headshot row={row} />
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
                  <TableCell className="font-mono text-xs tabular-nums">
                    {row.sessions.map((session) => session.code).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {dietaryLabels[row.contact.dietaryRequirements] ??
                      row.contact.dietaryRequirements}
                  </TableCell>
                  <TableCell className="text-xs">{row.contact.tshirtSize ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[
                      row.contact.linkedinUrl && "LinkedIn",
                      row.contact.twitterUrl && "Twitter",
                      row.contact.websiteUrl && "Web",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
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
          if (!open) setSelectedId(undefined);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected === undefined ? null : (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Headshot row={selected} large />
                  <div>
                    <SheetTitle>
                      {selected.contact.firstName} {selected.contact.lastName}
                    </SheetTitle>
                    <SheetDescription>
                      {[selected.contact.title, selected.contact.company]
                        .filter(Boolean)
                        .join(" · ") || selected.contact.email}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-4 text-xs">
                <section>
                  <h3 className="font-medium text-muted-foreground">Contact and logistics</h3>
                  <p className="mt-1">
                    {selected.contact.email}
                    {selected.contact.phone === null ? "" : ` · ${selected.contact.phone}`}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {dietaryLabels[selected.contact.dietaryRequirements] === "—"
                      ? "No dietary needs"
                      : dietaryLabels[selected.contact.dietaryRequirements]}
                    {selected.contact.tshirtSize === null
                      ? ""
                      : ` · T-shirt ${selected.contact.tshirtSize}`}
                  </p>
                </section>
                <section>
                  <h3 className="font-medium text-muted-foreground">Bio</h3>
                  {selected.contact.bio === null ? (
                    <p className="mt-1 italic text-muted-foreground">No bio yet.</p>
                  ) : (
                    <div
                      className="rte-content mt-1 text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: selected.contact.bio }}
                    />
                  )}
                </section>
                <section>
                  <h3 className="font-medium text-muted-foreground">Sessions</h3>
                  <div className="mt-2 divide-y overflow-hidden rounded-lg border">
                    {selected.sessions.length === 0 ? (
                      <p className="p-3 text-muted-foreground">No sessions attached.</p>
                    ) : (
                      selected.sessions.map((session) => (
                        <p key={session.id} className="px-3 py-2">
                          <span className="font-mono tabular-nums">{session.code}</span> —{" "}
                          {session.title}
                        </p>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <CsvImport eventId={eventId} open={importOpen} close={() => setImportOpen(false)} />
    </main>
  );
}

function Headshot({
  row,
  large = false,
}: {
  readonly row: SpeakerDirectoryRow;
  readonly large?: boolean;
}) {
  const classes = large ? "size-12 text-sm" : "size-8 text-xs";
  return row.contact.headshotUrl === null ? (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold",
        classes,
      )}
    >
      {row.contact.firstName[0]}
      {row.contact.lastName[0]}
    </div>
  ) : (
    <img
      src={row.contact.headshotUrl}
      alt=""
      className={cn("shrink-0 rounded-md object-cover", classes)}
    />
  );
}

interface PreviewRow {
  readonly number: number;
  readonly row: SpeakerCsvRow;
  readonly errors: ReadonlyArray<string>;
}
interface Preview {
  readonly headers: ReadonlyArray<string>;
  readonly mapping: ReadonlyArray<{ header: string; field: string }>;
  readonly rows: ReadonlyArray<PreviewRow>;
}
const aliases: Readonly<Record<string, keyof SpeakerCsvRow>> = {
  firstname: "firstName",
  first: "firstName",
  lastname: "lastName",
  last: "lastName",
  email: "email",
  emailaddress: "email",
  title: "title",
  jobtitle: "title",
  company: "company",
  organization: "company",
  bio: "bio",
  biography: "bio",
  dietary: "dietary",
  dietaryrequirements: "dietary",
  tshirt: "tshirt",
  tshirtsize: "tshirt",
  linkedin: "linkedin",
  linkedinurl: "linkedin",
  twitter: "twitter",
  x: "twitter",
  twitterurl: "twitter",
  facebook: "facebook",
  facebookurl: "facebook",
  website: "website",
  websiteurl: "website",
  phone: "phone",
  phonenumber: "phone",
};
const parseCells = (text: string) => {
  const rows: Array<Array<string>> = [[]];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      rows.at(-1)?.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(cell);
      cell = "";
      rows.push([]);
    } else cell += char;
  }
  rows.at(-1)?.push(cell);
  return rows.filter((row) => row.some((value) => value.trim() !== ""));
};
const parsePreview = (text: string): Preview => {
  const cells = parseCells(text);
  const headers = cells[0]?.map((value) => value.trim()) ?? [];
  const mapping = headers.flatMap((header, index) => {
    const field = aliases[header.toLowerCase().replace(/[^a-z0-9]/g, "")];
    return field === undefined ? [] : [{ header, field, index }];
  });
  const rows = cells.slice(1).map((values, index) => {
    const valueFor = (field: keyof SpeakerCsvRow) => {
      const match = mapping.find((item) => item.field === field);
      return match === undefined ? "" : (values[match.index]?.trim() ?? "");
    };
    const nullable = (field: keyof SpeakerCsvRow) => valueFor(field) || null;
    const row: SpeakerCsvRow = {
      firstName: valueFor("firstName"),
      lastName: valueFor("lastName"),
      email: valueFor("email"),
      title: nullable("title"),
      company: nullable("company"),
      bio: nullable("bio"),
      dietary: valueFor("dietary") || "none",
      tshirt: nullable("tshirt"),
      linkedin: nullable("linkedin"),
      twitter: nullable("twitter"),
      facebook: nullable("facebook"),
      website: nullable("website"),
      phone: nullable("phone"),
    };
    const errors = [
      row.firstName === "" ? "First name is required" : null,
      row.lastName === "" ? "Last name is required" : null,
      !row.email.includes("@") ? "Valid email is required" : null,
    ].filter((value): value is string => value !== null);
    return { number: index + 2, row, errors };
  });
  return { headers, mapping: mapping.map(({ header, field }) => ({ header, field })), rows };
};

function CsvImport({
  eventId,
  open,
  close,
}: {
  readonly eventId: string;
  readonly open: boolean;
  readonly close: () => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview>();
  const mutation = useMutation({
    mutationFn: (rows: ReadonlyArray<SpeakerCsvRow>) =>
      importSpeakerCsv({ data: { eventId, rows } }),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: speakerDirectoryQuery(eventId).queryKey });
      setPreview(undefined);
      close();
    },
  });
  const errors = preview?.rows.reduce((total, row) => total + row.errors.length, 0) ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setPreview(undefined);
          close();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import speakers from CSV</DialogTitle>
          <DialogDescription>
            Headers are matched without regard to case, spacing, underscores, or column order.
            Existing event contacts are updated by email.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) setPreview(parsePreview(await file.text()));
          }}
        />
        {preview === undefined ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="pressable rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground hover:bg-muted/40"
          >
            <UploadIcon className="mx-auto mb-2 size-5" />
            Choose speakers.csv
          </button>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {preview.mapping.map((item) => (
                <span
                  key={`${item.header}-${item.field}`}
                  className="rounded-md border px-1.5 py-0.5 text-[11px]"
                >
                  {item.header} → {item.field}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 5).map((item) => (
                    <TableRow key={item.number}>
                      <TableCell className="tabular-nums">{item.number}</TableCell>
                      <TableCell>
                        {item.row.firstName} {item.row.lastName}
                      </TableCell>
                      <TableCell>{item.row.email}</TableCell>
                      <TableCell>{item.row.company ?? "—"}</TableCell>
                      <TableCell
                        className={
                          item.errors.length > 0
                            ? "text-destructive"
                            : "text-[var(--status-accepted)]"
                        }
                      >
                        {item.errors.join("; ") || "Ready"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(5, preview.rows.length)} of {preview.rows.length} rows ·{" "}
              {errors === 0
                ? "All rows ready"
                : `${errors} validation error${errors === 1 ? "" : "s"}`}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          {preview === undefined ? null : (
            <Button
              disabled={preview.rows.length === 0 || errors > 0 || mutation.isPending}
              onClick={() => mutation.mutate(preview.rows.map((item) => item.row))}
            >
              {mutation.isPending ? "Importing…" : `Import ${preview.rows.length} speakers`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
