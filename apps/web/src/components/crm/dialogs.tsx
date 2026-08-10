import {
  mergeCanonicalProfiles,
  normalizeCrmEmail,
  resolveMergeFields,
  type CrmDirectoryFilters,
  type CrmImportResult,
  type CrmWorkspace,
  type DuplicateCandidate,
} from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpIcon, MailIcon, MergeIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { parseCsv, splitName } from "@/components/crm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { crmWorkspaceQuery } from "@/lib/crm-queries";
import {
  importCrmContacts,
  mergeCrmContacts,
  saveCrmContact,
  saveCrmSegment,
  sendCrmCampaign,
} from "@/server-fns/crm";

const nullable = (value: string) => (value.trim().length === 0 ? null : value.trim());

export function ContactEditorDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: saveCrmContact,
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success(`Added ${result.data.firstName} ${result.data.lastName}`);
      onOpenChange(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      title: "",
      company: "",
      bio: "",
    },
    onSubmit: ({ value }) =>
      save.mutate({
        data: {
          id: null,
          firstName: value.firstName,
          lastName: value.lastName,
          email: value.email,
          title: nullable(value.title),
          company: nullable(value.company),
          bio: nullable(value.bio),
          linkedinUrl: null,
          twitterUrl: null,
          facebookUrl: null,
          websiteUrl: null,
          headshotUrl: null,
          custom: {},
        },
      }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add CRM contact</DialogTitle>
          <DialogDescription>
            Create a canonical organization record. Event links stay separate.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            {(["firstName", "lastName"] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {name === "firstName" ? "First name" : "Last name"}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      required
                    />
                  </Field>
                )}
              </form.Field>
            ))}
          </div>
          {(["email", "title", "company"] as const).map((name) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {name === "email" ? "Email" : name === "title" ? "Title" : "Company"}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type={name === "email" ? "email" : "text"}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required={name === "email"}
                  />
                </Field>
              )}
            </form.Field>
          ))}
          <form.Field name="bio">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Bio</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  rows={4}
                />
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="pressable" disabled={save.isPending}>
              <PlusIcon /> Add contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MappingKey = "name" | "email" | "title" | "company" | "bio";
const mappingKeys: ReadonlyArray<MappingKey> = ["name", "email", "title", "company", "bio"];

export function ImportDialog({
  open,
  onOpenChange,
  workspace,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspace: CrmWorkspace;
}) {
  const queryClient = useQueryClient();
  const [table, setTable] = useState<ReadonlyArray<ReadonlyArray<string>>>([]);
  const [mapping, setMapping] = useState<Readonly<Record<MappingKey, string>>>({
    name: "",
    email: "",
    title: "",
    company: "",
    bio: "",
  });
  const [behavior, setBehavior] = useState<"update" | "skip">("update");
  const [result, setResult] = useState<CrmImportResult>();
  const headers = table[0] ?? [];
  const sourceRows = table.slice(1);
  const mapped = sourceRows.flatMap((row) => {
    const read = (key: MappingKey) => {
      const index = headers.indexOf(mapping[key]);
      return index === -1 ? "" : (row[index] ?? "").trim();
    };
    const email = read("email");
    if (email.length === 0) return [];
    const name = splitName(read("name"));
    return [
      {
        ...name,
        email,
        title: nullable(read("title")),
        company: nullable(read("company")),
        bio: nullable(read("bio")),
      },
    ];
  });
  const existingEmails = new Set(
    workspace.directory.map((row) => normalizeCrmEmail(row.contact.email)),
  );
  const submit = useMutation({
    mutationFn: () => importCrmContacts({ data: { behavior, rows: mapped } }),
    onSuccess: async (response) => {
      if (!response.ok) return toast.error(response.error.message);
      setResult(response.data);
      toast.success(
        `Imported ${response.data.created + response.data.updated} contacts · ${response.data.skipped} skipped`,
      );
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  const upload = async (file: File) => {
    const parsed = parseCsv(await file.text());
    const nextHeaders = parsed[0] ?? [];
    const find = (key: MappingKey) =>
      nextHeaders.find((header) => header.trim().toLowerCase() === key) ?? "";
    setTable(parsed);
    setMapping({
      name: find("name"),
      email: find("email"),
      title: find("title"),
      company: find("company"),
      bio: find("bio"),
    });
    setResult(undefined);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import organization contacts</DialogTitle>
          <DialogDescription>
            Upload CSV, map headers, preview every row, then choose how matching normalized email
            addresses are handled.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".csv,text/csv"
          aria-label="Speaker CSV"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void upload(file);
          }}
        />
        {headers.length === 0 ? (
          <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            <FileUpIcon className="mx-auto mb-2 size-5" />
            Choose speakers.csv to begin mapping.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {mappingKeys.map((key) => (
                <Field key={key}>
                  <FieldLabel className="capitalize">{key}</FieldLabel>
                  <Select
                    value={mapping[key] || "none"}
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [key]: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not mapped</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
            <div className="flex items-center gap-3 border-y py-2">
              <span className="text-xs font-medium">Matching email</span>
              <Select
                value={behavior}
                onValueChange={(value) => {
                  if (value === "update" || value === "skip") setBehavior(value);
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">Update existing</SelectItem>
                  <SelectItem value="skip">Skip existing</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {mapped.length} rows ready
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapped.map((row, index) => {
                    const matching = existingEmails.has(normalizeCrmEmail(row.email));
                    return (
                      <TableRow key={`${row.email}-${index}`}>
                        <TableCell>
                          {row.firstName} {row.lastName}
                        </TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.title ?? "—"}</TableCell>
                        <TableCell>{row.company ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {matching ? (behavior === "update" ? "Update" : "Skip") : "Create"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {result === undefined ? null : (
          <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20 text-center">
            <div className="p-3">
              <p className="text-xl font-semibold tabular-nums">{result.created}</p>
              <p className="text-xs text-muted-foreground">Created</p>
            </div>
            <div className="p-3">
              <p className="text-xl font-semibold tabular-nums">{result.updated}</p>
              <p className="text-xs text-muted-foreground">Updated</p>
            </div>
            <div className="p-3">
              <p className="text-xl font-semibold tabular-nums">{result.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result === undefined ? "Cancel" : "Done"}
          </Button>
          <Button
            className="pressable"
            disabled={
              mapped.length === 0 || mapping.name === "" || mapping.email === "" || submit.isPending
            }
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Importing…" : "Import contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SegmentDialog({
  open,
  onOpenChange,
  filters,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly filters: CrmDirectoryFilters;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => saveCrmSegment({ data: { name, filter: filters } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success(`Saved segment ${result.data.name}`);
      setName("");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save dynamic segment</DialogTitle>
          <DialogDescription>
            The current search, company, title, and tag filters are stored. Membership is
            recalculated whenever you open it.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="segment-name">Segment name</FieldLabel>
          <Input
            id="segment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Platform leaders"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="pressable" disabled={save.isPending} onClick={() => save.mutate()}>
            Save segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MergeDialog({
  open,
  onOpenChange,
  workspace,
  candidates,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspace: CrmWorkspace;
  readonly candidates: ReadonlyArray<DuplicateCandidate>;
}) {
  const queryClient = useQueryClient();
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidate = candidates[candidateIndex];
  const [primaryId, setPrimaryId] = useState(candidate?.primaryId ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const left = workspace.directory.find((row) => row.contact.id === candidate?.primaryId)?.contact;
  const right = workspace.directory.find(
    (row) => row.contact.id === candidate?.duplicateId,
  )?.contact;
  const primary = primaryId === right?.id ? right : left;
  const duplicate = primaryId === right?.id ? left : right;
  const merged =
    primary === undefined || duplicate === undefined
      ? undefined
      : mergeCanonicalProfiles(primary, duplicate);
  const merge = useMutation({
    mutationFn: () => mergeCrmContacts({ data: { primaryId, duplicateId: duplicate?.id ?? "" } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      toast.success(`Merged into ${result.data.firstName} ${result.data.lastName}`);
      setConfirmed(false);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate contacts</DialogTitle>
          <DialogDescription>
            Choose the canonical primary, preview the combined profile, and confirm. The duplicate
            record is removed.
          </DialogDescription>
        </DialogHeader>
        {candidate === undefined || left === undefined || right === undefined ? (
          <p className="py-8 text-center text-muted-foreground">No duplicate candidates remain.</p>
        ) : (
          <div className="grid gap-4">
            {candidates.length > 1 ? (
              <Select
                value={String(candidateIndex)}
                onValueChange={(value) => {
                  const index = Number(value);
                  setCandidateIndex(index);
                  setPrimaryId(candidates[index]?.primaryId ?? "");
                  setConfirmed(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((item, index) => {
                    const first = workspace.directory.find(
                      (row) => row.contact.id === item.primaryId,
                    )?.contact;
                    const second = workspace.directory.find(
                      (row) => row.contact.id === item.duplicateId,
                    )?.contact;
                    return (
                      <SelectItem
                        key={`${item.primaryId}-${item.duplicateId}`}
                        value={String(index)}
                      >
                        {first?.firstName} {first?.lastName} · {first?.email} ↔ {second?.firstName}{" "}
                        {second?.lastName} · {second?.email}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : null}
            <Field>
              <FieldLabel>Primary contact</FieldLabel>
              <Select
                value={primaryId}
                onValueChange={(value) => {
                  setPrimaryId(value);
                  setConfirmed(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={left.id}>
                    {left.firstName} {left.lastName} · {left.email}
                  </SelectItem>
                  <SelectItem value={right.id}>
                    {right.firstName} {right.lastName} · {right.email}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {merged === undefined ? null : (
              <div className="rounded-lg border">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                  Combined record preview
                </div>
                <dl className="divide-y">
                  {[
                    ["Name", `${merged.firstName} ${merged.lastName}`],
                    ["Email", merged.email],
                    ["Title", merged.title ?? "—"],
                    ["Company", merged.company ?? "—"],
                    ["Bio", merged.bio ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[100px_1fr] px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <Checkbox
                id="merge-confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label htmlFor="merge-confirm" className="text-xs leading-relaxed">
                I understand the duplicate record will be removed. All notes, tags, event links,
                custom metadata, and pipeline transition history will be preserved on the primary.
              </label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="pressable"
            disabled={!confirmed || duplicate === undefined || merge.isPending}
            onClick={() => merge.mutate()}
          >
            <MergeIcon /> Confirm merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignDialog({
  open,
  onOpenChange,
  workspace,
  contactIds,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspace: CrmWorkspace;
  readonly contactIds: ReadonlyArray<string>;
}) {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState(workspace.events[0]?.id ?? "");
  const [subject, setSubject] = useState("A speaking opportunity for {speaker_name}");
  const [body, setBody] = useState(
    "Hello {speaker_name},\n\nWe would love to discuss a session for {talk_title}.",
  );
  const [sent, setSent] = useState<number>();
  const contacts = useMemo(
    () => workspace.directory.filter((row) => contactIds.includes(row.contact.id)),
    [workspace.directory, contactIds],
  );
  const send = useMutation({
    mutationFn: () =>
      sendCrmCampaign({ data: { eventId, organizationContactIds: contactIds, subject, body } }),
    onSuccess: async (result) => {
      if (!result.ok) return toast.error(result.error.message);
      setSent(result.data.sent);
      toast.success(`Sent ${result.data.sent} personalized emails`);
      await queryClient.invalidateQueries({ queryKey: crmWorkspaceQuery.queryKey });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Email {contactIds.length} CRM contacts</DialogTitle>
          <DialogDescription>
            Recipients are linked to the selected event without duplicate entry. Supported tokens:{" "}
            {"{speaker_name}"} and {"{talk_title}"}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field>
            <FieldLabel>Campaign event</FieldLabel>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspace.events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="crm-subject">Subject</FieldLabel>
            <Input
              id="crm-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="crm-body">Message</FieldLabel>
            <Textarea
              id="crm-body"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Resolved recipient preview
            </p>
            <div className="max-h-56 divide-y overflow-auto rounded-lg border">
              {contacts.map((row) => {
                const fields = {
                  speaker_name: `${row.contact.firstName} ${row.contact.lastName}`,
                  talk_title: "your proposed topic",
                };
                return (
                  <div key={row.contact.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{fields.speaker_name}</span>
                      <span className="text-xs text-muted-foreground">{row.contact.email}</span>
                    </div>
                    <p className="mt-1 text-xs">{resolveMergeFields(subject, fields)}</p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                      {resolveMergeFields(body, fields)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          {sent === undefined ? null : (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <MailIcon className="size-4" />
              <span className="font-medium">Campaign sent</span>
              <Badge variant="secondary" className="ml-auto">
                {sent} recipients
              </Badge>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {sent === undefined ? "Cancel" : "Done"}
          </Button>
          <Button
            className="pressable"
            disabled={send.isPending || contactIds.length === 0 || sent !== undefined}
            onClick={() => send.mutate()}
          >
            <MailIcon /> {send.isPending ? "Sending…" : "Send campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
