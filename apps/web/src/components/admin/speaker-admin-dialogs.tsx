import type {
  DietaryRequirement,
  SpeakerCsvRow,
  SpeakerDirectoryRow,
  SpeakerPipeline,
  TshirtSize,
} from "@opensesh/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, UploadIcon, UserRoundIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ImageUploadField } from "@/components/forms/image-upload";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
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
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { fileAsBase64 } from "@/lib/files";
import { type CsvPreview, parseSpeakerCsv } from "@/lib/speaker-csv";
import { saveAdminSpeaker, uploadAdminSpeakerHeadshot } from "@/server-fns/speaker-comms";
import { importSpeakerCsv } from "@/server-fns/widgets";

export const pipelineLabels: Readonly<Record<SpeakerPipeline, string>> = {
  withdrawn: "Withdrawn",
  ready: "Ready",
  onboarding: "Onboarding",
  invited: "Invited",
  added: "Not invited",
};

const pipelineClasses: Readonly<Record<SpeakerPipeline, string>> = {
  withdrawn: "bg-[var(--status-withdrawn)] text-[var(--status-withdrawn-foreground)]",
  ready: "bg-[var(--status-accepted)] text-[var(--status-accepted-foreground)]",
  onboarding: "bg-[var(--status-maybe)] text-[var(--status-maybe-foreground)]",
  invited: "bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
  added: "bg-muted text-muted-foreground",
};

export function PipelineBadge({ status }: { readonly status: SpeakerPipeline }) {
  return (
    <Badge className={`rounded-md px-1.5 py-0.5 text-xs ${pipelineClasses[status]}`}>
      {pipelineLabels[status]}
    </Badge>
  );
}

const valueOrNull = (value: string) => (value.trim().length === 0 ? null : value.trim());

interface SpeakerFormState {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly title: string;
  readonly company: string;
  readonly bio: string;
  readonly twitterUrl: string;
  readonly linkedinUrl: string;
  readonly websiteUrl: string;
  readonly dietaryRequirements: DietaryRequirement;
  readonly tshirtSize: TshirtSize | "none";
  readonly travelLogistics: string;
}

const dietaryValue = (value: string): DietaryRequirement =>
  value === "vegetarian" || value === "vegan" || value === "gluten_free" || value === "other"
    ? value
    : "none";
const tshirtValue = (value: string): TshirtSize | "none" =>
  value === "XS" ||
  value === "S" ||
  value === "M" ||
  value === "L" ||
  value === "XL" ||
  value === "XXL"
    ? value
    : "none";
export function SpeakerFormDialog({
  eventId,
  speaker,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly speaker: SpeakerDirectoryRow | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const logistics = speaker?.contact.custom.travelLogistics;
  const [form, setForm] = useState<SpeakerFormState>(() => ({
    firstName: speaker?.contact.firstName ?? "",
    lastName: speaker?.contact.lastName ?? "",
    email: speaker?.contact.email ?? "",
    title: speaker?.contact.title ?? "",
    company: speaker?.contact.company ?? "",
    bio: speaker?.contact.bio ?? "",
    twitterUrl: speaker?.contact.twitterUrl ?? "",
    linkedinUrl: speaker?.contact.linkedinUrl ?? "",
    websiteUrl: speaker?.contact.websiteUrl ?? "",
    dietaryRequirements: dietaryValue(speaker?.contact.dietaryRequirements ?? "none"),
    tshirtSize: tshirtValue(speaker?.contact.tshirtSize ?? "none"),
    travelLogistics: typeof logistics === "string" ? logistics : "",
  }));
  const [headshot, setHeadshot] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const saved = await saveAdminSpeaker({
        data: {
          eventId,
          id: speaker?.contact.id ?? null,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          title: valueOrNull(form.title),
          company: valueOrNull(form.company),
          bio: valueOrNull(form.bio),
          twitterUrl: valueOrNull(form.twitterUrl),
          linkedinUrl: valueOrNull(form.linkedinUrl),
          websiteUrl: valueOrNull(form.websiteUrl),
          dietaryRequirements: form.dietaryRequirements,
          tshirtSize: form.tshirtSize === "none" ? null : form.tshirtSize,
          travelLogistics: valueOrNull(form.travelLogistics),
        },
      });
      if (!saved.ok || headshot === null) return saved;
      const uploaded = await uploadAdminSpeakerHeadshot({
        data: {
          eventId,
          contactId: saved.data.id,
          filename: headshot.name,
          contentType: headshot.type,
          size: headshot.size,
          base64: await fileAsBase64(headshot),
        },
      });
      return uploaded.ok ? saved : uploaded;
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(speaker === undefined ? "Speaker added" : "Speaker profile saved");
      // Unscoped: contact enrichment is org-wide (shared contacts feed every event).
      await invalidateAfterMutation(queryClient);
      onOpenChange(false);
    },
  });
  const update = <Key extends keyof SpeakerFormState>(key: Key, value: SpeakerFormState[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(52rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="m-0 shrink-0 gap-1 border-b px-5 py-4 pr-12">
          <DialogTitle className="text-base">
            {speaker === undefined
              ? "Add speaker"
              : `Edit ${speaker.contact.firstName} ${speaker.contact.lastName}`}
          </DialogTitle>
          <DialogDescription>
            The profile, headshot, and links shown on public pages, plus event-day logistics.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid content-start gap-6">
              <section className="grid gap-3">
                <SectionLabel>Identity</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First name"
                    value={form.firstName}
                    set={(value) => update("firstName", value)}
                  />
                  <Field
                    label="Last name"
                    value={form.lastName}
                    set={(value) => update("lastName", value)}
                  />
                </div>
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  set={(value) => update("email", value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Title" value={form.title} set={(value) => update("title", value)} />
                  <Field
                    label="Company"
                    value={form.company}
                    set={(value) => update("company", value)}
                  />
                </div>
              </section>
              <section className="grid gap-3">
                <SectionLabel>Biography</SectionLabel>
                <RichTextEditor
                  value={form.bio}
                  onChange={(value) => update("bio", value.slice(0, 5000))}
                />
              </section>
            </div>
            <div className="grid content-start gap-6">
              <section className="grid gap-3">
                <SectionLabel>Headshot</SectionLabel>
                <ImageUploadField
                  id="speaker-headshot"
                  label="Upload speaker headshot"
                  accept="image/*"
                  hint="Any image · 2 MB max"
                  value={headshot}
                  onChange={setHeadshot}
                  currentUrl={speaker?.contact.headshotUrl ?? null}
                  fallbackIcon={<UserRoundIcon className="size-4 text-muted-foreground" />}
                />
              </section>
              <section className="grid gap-3">
                <SectionLabel>Links</SectionLabel>
                <Field
                  label="X / Twitter"
                  placeholder="https://x.com/…"
                  value={form.twitterUrl}
                  set={(value) => update("twitterUrl", value)}
                />
                <Field
                  label="LinkedIn"
                  placeholder="https://linkedin.com/in/…"
                  value={form.linkedinUrl}
                  set={(value) => update("linkedinUrl", value)}
                />
                <Field
                  label="Website"
                  placeholder="https://…"
                  value={form.websiteUrl}
                  set={(value) => update("websiteUrl", value)}
                />
              </section>
              <section className="grid gap-3">
                <SectionLabel>Event logistics</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Dietary"
                    value={form.dietaryRequirements}
                    options={[
                      ["none", "None"],
                      ["vegetarian", "Vegetarian"],
                      ["vegan", "Vegan"],
                      ["gluten_free", "Gluten-free"],
                      ["other", "Other"],
                    ]}
                    set={(value) => update("dietaryRequirements", dietaryValue(value))}
                  />
                  <SelectField
                    label="T-shirt size"
                    value={form.tshirtSize}
                    options={[
                      ["none", "Not set"],
                      ...["XS", "S", "M", "L", "XL", "XXL"].map((size) => [size, size] as const),
                    ]}
                    set={(value) => update("tshirtSize", tshirtValue(value))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="speaker-logistics" className="text-xs">
                    Travel notes
                  </Label>
                  <Textarea
                    id="speaker-logistics"
                    value={form.travelLogistics}
                    onChange={(event) => update("travelLogistics", event.target.value)}
                    placeholder="Arrival, seat preference, hotel, dietary notes…"
                    className="min-h-24"
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
        <DialogFooter className="m-0 shrink-0 border-t bg-background px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              mutation.isPending ||
              form.firstName.trim() === "" ||
              form.lastName.trim() === "" ||
              !form.email.includes("@")
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save speaker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  set,
}: {
  readonly label: string;
  readonly type?: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly set: (value: string) => void;
}) {
  const id = `speaker-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  set,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<readonly [string, string]>;
  readonly set: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, text]) => (
            <SelectItem key={option} value={option}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CsvImportDialog({
  eventId,
  speakers,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly speakers: ReadonlyArray<SpeakerDirectoryRow>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvPreview>();
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number }>();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (rows: ReadonlyArray<SpeakerCsvRow>) =>
      importSpeakerCsv({ data: { eventId, rows } }),
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.error.message);
        return;
      }
      setResult(response.data);
      await invalidateAfterMutation(queryClient);
    },
  });
  const errors = preview?.rows.reduce((total, row) => total + row.errors.length, 0) ?? 0;
  const updateAction = (number: number, action: SpeakerCsvRow["action"]) =>
    setPreview((current) =>
      current === undefined
        ? current
        : {
            ...current,
            rows: current.rows.map((item) =>
              item.number === number ? { ...item, row: { ...item.row, action } } : item,
            ),
          },
    );
  const reset = () => {
    setPreview(undefined);
    setResult(undefined);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import speakers from CSV</DialogTitle>
          <DialogDescription>
            Review automatic header mapping and choose Update or Skip for matching event emails.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file === undefined) return;
            setResult(undefined);
            setPreview(
              parseSpeakerCsv(
                await file.text(),
                new Set(speakers.map((speaker) => speaker.contact.email.trim().toLowerCase())),
              ),
            );
          }}
        />
        {result !== undefined ? (
          <div className="grid gap-3 py-6 text-center">
            <CheckIcon className="mx-auto size-8 text-[var(--status-accepted)]" />
            <h3 className="text-base font-semibold">Import complete</h3>
            <p className="text-sm text-muted-foreground tabular-nums">
              Created {result.created} · Updated {result.updated} · Skipped {result.skipped}
            </p>
          </div>
        ) : preview === undefined ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
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
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((item) => (
                    <TableRow key={item.number}>
                      <TableCell className="tabular-nums">{item.number}</TableCell>
                      <TableCell>
                        {item.row.firstName} {item.row.lastName}
                      </TableCell>
                      <TableCell>{item.row.email}</TableCell>
                      <TableCell>{item.row.company ?? "—"}</TableCell>
                      <TableCell>
                        {item.errors.length > 0 ? (
                          <span className="text-destructive">{item.errors.join("; ")}</span>
                        ) : item.matched ? (
                          <Select
                            value={item.row.action}
                            onValueChange={(value) =>
                              updateAction(item.number, value === "skip" ? "skip" : "update")
                            }
                          >
                            <SelectTrigger size="sm" className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="update">Update</SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          // Match the select trigger's height so mixed
                          // Update/Create rows keep a uniform height.
                          <span className="flex h-8 items-center">
                            <Badge variant="outline">Create</Badge>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {preview.rows.length} parsed · {preview.rows.filter((row) => row.matched).length}{" "}
              matching · {errors} errors
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result === undefined ? "Cancel" : "Close"}
          </Button>
          {preview === undefined || result !== undefined ? null : (
            <Button
              disabled={errors > 0 || mutation.isPending}
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

export function PortalInviteResultDialog({
  open,
  onOpenChange,
  invitations,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly invitations: ReadonlyArray<{
    readonly contactId: string;
    readonly contactName: string;
    readonly portalPath: string;
    readonly alreadyInvited: boolean;
  }>;
}) {
  const [copied, setCopied] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Speaker portal invitations</DialogTitle>
          <DialogDescription>
            Welcome messages are recorded in demo mode. Copy a portal path below.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-lg border">
          {invitations.map((invitation) => (
            <div key={invitation.contactId} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{invitation.contactName}</p>
                <p className="text-xs text-muted-foreground">
                  {invitation.alreadyInvited ? "Already invited" : "Invitation sent"} ·{" "}
                  {invitation.portalPath}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Copy portal path for ${invitation.contactName}`}
                onClick={async () => {
                  await navigator.clipboard.writeText(invitation.portalPath);
                  setCopied(invitation.contactId);
                  toast.success("Portal path copied");
                }}
              >
                {copied === invitation.contactId ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
