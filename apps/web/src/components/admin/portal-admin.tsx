import type { FormFieldDefinition, PortalFormSection } from "@opensesh/domain";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileArchiveIcon,
  FilterIcon,
  HistoryIcon,
  PlusIcon,
  RotateCcwIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/app/status-badge";
import { PersonTag } from "@/components/app/person-tag";
import { FormFieldBuilder } from "@/components/forms/form-field-builder";
import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { FileThread } from "@/components/portal/file-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminEvent } from "@/components/app/admin-event-context";
import { dataUrlForVersion, downloadZip, fetchVersionData } from "@/lib/files";
import { adminPortalQuery } from "@/lib/portal-queries";
import {
  acceptPortalSubmission,
  approveContentChange,
  createAdminFileRequest,
  getPortalAdmin,
  manualAssignAdminTask,
  rejectContentChange,
  restoreAdminHistory,
  saveAdminPortalForm,
  saveAdminTaskTemplate,
  waiveAdminAssignment,
} from "@/server-fns/portal";

type AdminData = Extract<Awaited<ReturnType<typeof getPortalAdmin>>, { readonly ok: true }>["data"];

export function PortalAdminSection({ section }: { readonly section: string }) {
  const eventContext = useAdminEvent();
  if (eventContext === null) return null;
  return <PortalAdminData eventId={eventContext.event.id} section={section} />;
}

function PortalAdminData({
  eventId,
  section,
}: {
  readonly eventId: string;
  readonly section: string;
}) {
  const portal = useSuspenseQuery(adminPortalQuery(eventId));
  if (!portal.data.ok) return <p className="p-6">{portal.data.error.message}</p>;
  if (section === "tasks") return <AdminTasks eventId={eventId} data={portal.data.data} />;
  if (section === "portal-forms")
    return <AdminPortalForms eventId={eventId} data={portal.data.data} />;
  if (section === "file-requests")
    return <AdminFileRequests eventId={eventId} data={portal.data.data} />;
  if (section === "content") return <AdminSessions eventId={eventId} data={portal.data.data} />;
  return null;
}

function AdminTasks({ eventId, data }: { readonly eventId: string; readonly data: AdminData }) {
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
  const waive = useMutation({
    mutationFn: (assignmentId: string) => waiveAdminAssignment({ data: { eventId, assignmentId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      await refresh();
    },
  });
  const assign = useMutation({
    mutationFn: ({
      taskTemplateId,
      contactId,
    }: {
      readonly taskTemplateId: string;
      readonly contactId: string;
    }) =>
      manualAssignAdminTask({ data: { eventId, taskTemplateId, contactId, submissionId: null } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Task assigned");
      await refresh();
    },
  });
  const templateRows = data.templates.map((row) => ({
    ...row,
    assigned: data.assignments.filter((item) => item.assignment.taskTemplateId === row.template.id),
    done: data.assignments.filter(
      (item) =>
        item.assignment.taskTemplateId === row.template.id && item.assignment.status !== "todo",
    ),
  }));
  const speakers = Array.from(
    new Map(data.participants.map((row) => [row.contact.id, row.contact])).values(),
  )
    .map((contact) => {
      const submissionIds = data.participants
        .filter((row) => row.contact.id === contact.id)
        .map((row) => row.submission.id);
      const assignments = data.assignments.filter(
        (row) =>
          row.assignment.contactId === contact.id ||
          (row.assignment.submissionId !== null &&
            submissionIds.includes(row.assignment.submissionId)),
      );
      const outstanding = assignments.filter((row) => row.assignment.status === "todo").length;
      return { contact, assignments, outstanding, done: assignments.length - outstanding };
    })
    .filter((row) => !outstandingOnly || row.outstanding > 0)
    .sort(
      (left, right) =>
        right.outstanding - left.outstanding ||
        left.contact.lastName.localeCompare(right.contact.lastName),
    );
  const open = (id: string | null) => {
    setEditingId(id);
    setDrawer(true);
  };

  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="text-xs text-muted-foreground">
            Templates and real-time speaker readiness.
          </p>
        </div>
        <Button size="sm" onClick={() => open(null)}>
          <PlusIcon /> Add task
        </Button>
      </div>
      <Tabs defaultValue="templates">
        <TabsList variant="line">
          <TabsTrigger value="templates">Templates ({templateRows.length})</TabsTrigger>
          <TabsTrigger value="assignments">Assignments board</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="pt-3">
          <div className="grid gap-2">
            {templateRows.map((row) => (
              <button
                key={row.template.id}
                type="button"
                className="pressable flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm"
                onClick={() => open(row.template.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.template.title}</span>
                    <Badge variant="outline" className="capitalize">
                      {row.template.scope}
                    </Badge>
                    {row.template.autoAssignOnAccept ? (
                      <Badge variant="secondary">Auto-assign</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.form?.name ?? row.fileRequest?.title ?? "Manual completion"}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {row.done.length}/{row.assigned.length} done
                </span>
              </button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="assignments" className="pt-3">
          <label className="mb-3 flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
            <Checkbox
              checked={outstandingOnly}
              onCheckedChange={(checked) => setOutstandingOnly(checked === true)}
            />
            <FilterIcon className="size-3.5" /> Has outstanding
          </label>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Speaker</TableHead>
                  <TableHead>Dietary</TableHead>
                  <TableHead>T-shirt</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {speakers.map((row) => (
                  <Fragment key={row.contact.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === row.contact.id ? null : row.contact.id)
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChevronDownIcon
                            className={`size-3.5 ${expanded === row.contact.id ? "rotate-180" : ""}`}
                          />
                          <PersonTag
                            person={{
                              name: `${row.contact.firstName} ${row.contact.lastName}`,
                              image: row.contact.headshotUrl,
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {row.contact.dietaryRequirements.replace("_", "-")}
                      </TableCell>
                      <TableCell>{row.contact.tshirtSize ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.outstanding}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.done}</TableCell>
                    </TableRow>
                    {expanded === row.contact.id ? (
                      <TableRow key={`${row.contact.id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/20 p-3">
                          <div className="grid gap-2">
                            {row.assignments.map((assignment) => (
                              <div
                                key={assignment.assignment.id}
                                className="flex items-center justify-between rounded-md border bg-background px-2.5 py-2 text-xs"
                              >
                                <span>
                                  {assignment.template.title}
                                  {assignment.submission === null
                                    ? ""
                                    : ` · ${assignment.submission.code}`}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      assignment.assignment.status === "todo"
                                        ? "outline"
                                        : "secondary"
                                    }
                                    className="capitalize"
                                  >
                                    {assignment.assignment.status}
                                  </Badge>
                                  {assignment.assignment.status === "todo" ? (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => waive.mutate(assignment.assignment.id)}
                                    >
                                      Waive
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-xs text-muted-foreground">Manual assign:</span>
                              {data.templates.map((template) => (
                                <Button
                                  key={template.template.id}
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    assign.mutate({
                                      taskTemplateId: template.template.id,
                                      contactId: row.contact.id,
                                    })
                                  }
                                >
                                  {template.template.title}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      <TaskTemplateSheet
        key={editingId ?? "new"}
        eventId={eventId}
        data={data}
        templateId={editingId}
        open={drawer}
        onOpenChange={setDrawer}
      />
    </main>
  );
}

function TaskTemplateSheet({
  eventId,
  data,
  templateId,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly data: AdminData;
  readonly templateId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const existing = data.templates.find((row) => row.template.id === templateId)?.template;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    instructions: existing?.instructions ?? "",
    scope: existing?.scope ?? "contact",
    link:
      existing?.portalFormId === null || existing?.portalFormId === undefined
        ? existing?.fileRequestId === null || existing?.fileRequestId === undefined
          ? "manual"
          : `file:${existing.fileRequestId}`
        : `form:${existing.portalFormId}`,
    auto: existing?.autoAssignOnAccept ?? true,
    dueDate:
      existing?.dueDate === null || existing?.dueDate === undefined
        ? ""
        : new Date(existing.dueDate).toISOString().slice(0, 10),
  });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      saveAdminTaskTemplate({
        data: {
          eventId,
          id: templateId,
          title: form.title,
          instructions: form.instructions,
          scope: form.scope === "submission" ? "submission" : "contact",
          portalFormId: form.link.startsWith("form:") ? form.link.slice(5) : null,
          fileRequestId: form.link.startsWith("file:") ? form.link.slice(5) : null,
          autoAssignOnAccept: form.auto,
          dueDate: form.dueDate || null,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Task template saved");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
    },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{existing === undefined ? "Create task" : "Edit task"}</SheetTitle>
          <SheetDescription>Configure completion and automatic assignment.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Instructions</Label>
            <RichTextEditor
              value={form.instructions}
              onChange={(instructions) => setForm({ ...form, instructions })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(scope) =>
                  setForm({ ...form, scope: scope === "submission" ? "submission" : "contact" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Completion</Label>
            <Select value={form.link} onValueChange={(link) => setForm({ ...form, link })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual check-off</SelectItem>
                {data.forms.map((item) => (
                  <SelectItem key={item.id} value={`form:${item.id}`}>
                    Form · {item.name}
                  </SelectItem>
                ))}
                {data.fileRequests.map((item) => (
                  <SelectItem key={item.id} value={`file:${item.id}`}>
                    File · {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            Auto-assign on accept
            <Switch checked={form.auto} onCheckedChange={(auto) => setForm({ ...form, auto })} />
          </label>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={form.title.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save task
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdminPortalForms({
  eventId,
  data,
}: {
  readonly eventId: string;
  readonly data: AdminData;
}) {
  const [editorId, setEditorId] = useState<string | null | undefined>(undefined);
  const exportCsv = () => {
    const rows = data.responses.map((row) => ({
      submitter: `${row.contact.firstName} ${row.contact.lastName}`,
      email: row.contact.email,
      dietary: row.contact.dietaryRequirements,
      tshirt: row.contact.tshirtSize ?? "",
      submittedAt: new Date(row.response.submittedAt).toISOString(),
      answers: JSON.stringify(row.response.answers),
    }));
    downloadCsv("portal-form-responses.csv", rows);
  };
  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Portal forms</h1>
          <p className="text-xs text-muted-foreground">
            Collect structured onboarding information.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditorId(null)}>
          <PlusIcon /> Add form
        </Button>
      </div>
      <Tabs defaultValue="forms">
        <TabsList variant="line">
          <TabsTrigger value="forms">Forms ({data.forms.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses ({data.responses.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="forms" className="pt-3">
          <div className="grid gap-2">
            {data.forms.map((form) => (
              <button
                key={form.id}
                type="button"
                className="pressable flex items-center justify-between rounded-md border bg-card px-3 py-3 text-left"
                onClick={() => setEditorId(form.id)}
              >
                <div>
                  <p className="text-sm font-semibold">{form.name}</p>
                  <p className="text-xs text-muted-foreground">{form.title}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {form.targetType}
                </Badge>
              </button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="responses" className="pt-3">
          <div className="mb-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <DownloadIcon /> Export CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Answers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.responses.map((row) => {
                  const form = data.forms.find((item) => item.id === row.response.formId);
                  return (
                    <TableRow key={row.response.id}>
                      <TableCell>
                        <PersonTag
                          person={{
                            name: `${row.contact.firstName} ${row.contact.lastName}`,
                            image: row.contact.headshotUrl,
                          }}
                        />
                      </TableCell>
                      <TableCell>{form?.name ?? "Form"}</TableCell>
                      <TableCell className="text-xs">
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(row.response.submittedAt))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{form?.title ?? "Form response"}</DialogTitle>
                              <DialogDescription>{row.contact.email}</DialogDescription>
                            </DialogHeader>
                            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                              {JSON.stringify(row.response.answers, null, 2)}
                            </pre>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      {editorId === undefined ? null : (
        <PortalFormEditor
          eventId={eventId}
          data={data}
          formId={editorId}
          open
          onOpenChange={(open) => {
            if (!open) setEditorId(undefined);
          }}
        />
      )}
    </main>
  );
}

function PortalFormEditor({
  eventId,
  data,
  formId,
  open,
  onOpenChange,
}: {
  readonly eventId: string;
  readonly data: AdminData;
  readonly formId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const existing = data.forms.find((item) => item.id === formId);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [scope, setScope] = useState<"contact" | "submission">(existing?.targetType ?? "contact");
  const [sections, setSections] = useState<ReadonlyArray<PortalFormSection>>(
    existing?.sections ?? [
      { id: crypto.randomUUID(), title: "Your information", instructions: "", fields: [] },
    ],
  );
  const [confirmation, setConfirmation] = useState(existing?.confirmationEmailEnabled ?? false);
  const [emailBody, setEmailBody] = useState(existing?.confirmationEmailBody ?? "");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      saveAdminPortalForm({
        data: {
          eventId,
          id: formId,
          name,
          title,
          targetType: scope,
          sections,
          confirmationEmailEnabled: confirmation,
          confirmationEmailBody: emailBody || null,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Portal form saved");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
    },
  });
  const updateSection = (id: string, update: Partial<PortalFormSection>) =>
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...update } : section)),
    );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {existing === undefined ? "Create portal form" : "Edit portal form"}
          </SheetTitle>
          <SheetDescription>Setup, questions, and confirmation settings.</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <div className="mb-5 flex gap-1 rounded-md bg-muted p-1">
            {["Setup", "Questions", "Settings"].map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={`pressable flex-1 rounded px-2 py-1.5 text-xs font-medium ${step === index ? "bg-background" : "text-muted-foreground"}`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
          {step === 0 ? (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Internal name</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Public title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Scope</Label>
                <Select
                  value={scope}
                  onValueChange={(value) =>
                    setScope(value === "submission" ? "submission" : "contact")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="submission">Submission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : step === 1 ? (
            <div className="grid gap-4">
              {sections.map((section) => (
                <Card key={section.id}>
                  <CardHeader className="border-b py-3">
                    <Input
                      value={section.title}
                      onChange={(event) => updateSection(section.id, { title: event.target.value })}
                    />
                  </CardHeader>
                  <CardContent className="grid gap-4 py-4">
                    <div className="grid gap-1.5">
                      <Label>Instructions</Label>
                      <RichTextEditor
                        value={section.instructions}
                        onChange={(instructions) => updateSection(section.id, { instructions })}
                      />
                    </div>
                    <FormFieldBuilder
                      section="abstract"
                      fields={section.fields.map((field) => ({
                        ...field,
                        section: "abstract" as const,
                      }))}
                      onChange={(fields) =>
                        updateSection(section.id, {
                          fields: fields.map(({ section: _section, ...field }) => ({
                            ...field,
                            id: field.id ?? crypto.randomUUID(),
                          })) as ReadonlyArray<FormFieldDefinition>,
                        })
                      }
                    />
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setSections([
                    ...sections,
                    { id: crypto.randomUUID(), title: "New section", instructions: "", fields: [] },
                  ])
                }
              >
                <PlusIcon /> Add section
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                Send confirmation email
                <Switch checked={confirmation} onCheckedChange={setConfirmation} />
              </label>
              {confirmation ? (
                <div className="grid gap-1.5">
                  <Label>Email body</Label>
                  <RichTextEditor value={emailBody} onChange={setEmailBody} />
                </div>
              ) : null}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button
              disabled={step === 0 && (name.trim().length === 0 || title.trim().length === 0)}
              onClick={() => setStep(step + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              disabled={mutation.isPending || name.trim().length === 0 || title.trim().length === 0}
              onClick={() => mutation.mutate()}
            >
              Save form
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AdminFileRequests({
  eventId,
  data,
}: {
  readonly eventId: string;
  readonly data: AdminData;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", scope: "contact", instructions: "" });
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      createAdminFileRequest({
        data: {
          eventId,
          title: form.title,
          targetType: form.scope === "submission" ? "submission" : "contact",
          instructions: form.instructions,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("File request created");
      await queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
    },
  });
  const bundle = async (requestId: string, title: string) => {
    const uploads = data.files.filter((row) => row.upload.fileRequestId === requestId);
    const current = uploads.flatMap((row) =>
      data.versions
        .map((item) => item.version)
        .filter((version) => version.fileUploadId === row.upload.id)
        .sort(
          (left, right) =>
            new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
        )
        .slice(0, 1),
    );
    const files = (
      await Promise.all(current.map((version) => fetchVersionData(version.id)))
    ).filter((file) => file !== null);
    if (files.length === 0) {
      toast.error("No files to bundle");
      return;
    }
    downloadZip(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`, files);
  };
  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">File requests</h1>
          <p className="text-xs text-muted-foreground">
            Versioned uploads and cross-role review threads.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> Add request
        </Button>
      </div>
      <div className="grid gap-3">
        {data.fileRequests.map((request) => {
          const uploads = data.files.filter((row) => row.upload.fileRequestId === request.id);
          return (
            <Card key={request.id}>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{request.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {uploads.length} upload{uploads.length === 1 ? "" : "s"} ·{" "}
                      <span className="capitalize">{request.targetType}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void bundle(request.id, request.title)}
                  >
                    <FileArchiveIcon /> Download bundle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 py-3">
                {uploads.length === 0 ? (
                  <div className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
                    No uploads yet.
                  </div>
                ) : (
                  uploads.map((row) => {
                    const versions = data.versions
                      .map((item) => item.version)
                      .filter((version) => version.fileUploadId === row.upload.id);
                    const comments = data.comments
                      .map((item) => item.comment)
                      .filter((comment) => comment.fileUploadId === row.upload.id);
                    const unread = comments.some(
                      (comment) =>
                        comment.authorContactId !== null &&
                        (row.upload.adminLastReadAt === null ||
                          new Date(comment.createdAt) > new Date(row.upload.adminLastReadAt)),
                    );
                    return (
                      <div key={row.upload.id}>
                        <div className="mb-2 flex items-center justify-between">
                          <PersonTag
                            person={{
                              name: `${row.contact.firstName} ${row.contact.lastName}`,
                              image: row.contact.headshotUrl,
                            }}
                          />
                          {unread ? <Badge>Unread reply</Badge> : null}
                        </div>
                        <FileThread
                          eventId={eventId}
                          upload={row.upload}
                          versions={versions}
                          comments={comments}
                        />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add file request</SheetTitle>
            <SheetDescription>
              Files are stored on this request and versioned on every replacement.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={(scope) => setForm({ ...form, scope })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Instructions</Label>
              <RichTextEditor
                value={form.instructions}
                onChange={(instructions) => setForm({ ...form, instructions })}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={form.title.trim().length === 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              Create request
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function AdminSessions({ eventId, data }: { readonly eventId: string; readonly data: AdminData }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-portal", eventId] });
  const review = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      readonly id: string;
      readonly decision: "approve" | "reject";
    }) =>
      decision === "approve"
        ? approveContentChange({ data: { eventId, historyId: id } })
        : rejectContentChange({ data: { eventId, historyId: id } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Content review updated");
      await refresh();
    },
  });
  const restore = useMutation({
    mutationFn: (historyId: string) => restoreAdminHistory({ data: { eventId, historyId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Submission version restored");
      await refresh();
    },
  });
  const accept = useMutation({
    mutationFn: (submissionId: string) =>
      acceptPortalSubmission({ data: { eventId, submissionId } }),
    onSuccess: async (result) => {
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Submission accepted and onboarding tasks assigned");
      await refresh();
    },
  });
  const pendingHistory = data.history
    .map((item) => item.history)
    .filter((item) => item.approvalStatus === "pending_review");
  return (
    <main className="grid gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-semibold">Content</h1>
        <p className="text-xs text-muted-foreground">
          Accepted session content, speakers, and approval history.
        </p>
      </div>
      {pendingHistory.length === 0 ? null : (
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">
              Content changes awaiting approval ({pendingHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {pendingHistory.map((entry) => {
              const submission = data.submissions.find((item) => item.id === entry.submissionId);
              return (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {submission?.code} — {submission?.title}
                    </p>
                    <p className="text-muted-foreground">
                      {entry.authorName} changed {entry.changedFields.join(", ")}
                    </p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Review content changes</DialogTitle>
                        <DialogDescription>
                          {submission?.code} · {entry.authorName}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-2">
                        {entry.changedFields.map((field) => (
                          <div key={field} className="grid grid-cols-2 gap-2 text-xs">
                            <pre className="whitespace-pre-wrap rounded bg-muted p-2">
                              {formatJson(entry.previousValues[field])}
                            </pre>
                            <pre className="whitespace-pre-wrap rounded bg-muted p-2">
                              {formatJson(entry.newValues[field])}
                            </pre>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => review.mutate({ id: entry.id, decision: "reject" })}
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => review.mutate({ id: entry.id, decision: "approve" })}
                        >
                          Approve
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Speakers</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.submissions
              .filter((item) => item.status === "accepted" || item.status === "pending")
              .map((submission) => {
                const speakers = data.participants.filter(
                  (row) => row.submission.id === submission.id,
                );
                const history = data.history
                  .map((item) => item.history)
                  .filter((item) => item.submissionId === submission.id);
                return (
                  <Fragment key={submission.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === submission.id ? null : submission.id)}
                    >
                      <TableCell>
                        <span className="font-mono text-xs tabular-nums">{submission.code}</span> —{" "}
                        <span className="font-medium">{submission.title}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={submission.status} />
                      </TableCell>
                      <TableCell>
                        {speakers.length === 0
                          ? "—"
                          : speakers
                              .map((row) => `${row.contact.firstName} ${row.contact.lastName}`)
                              .join(", ")}
                      </TableCell>
                      <TableCell className="text-right">
                        {submission.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              accept.mutate(submission.id);
                            }}
                          >
                            <UserRoundCheckIcon /> Accept
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost">
                            <ChevronDownIcon />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded === submission.id ? (
                      <TableRow key={`${submission.id}-detail`}>
                        <TableCell colSpan={4} className="bg-muted/20 p-4">
                          <Tabs defaultValue="speakers">
                            <TabsList variant="line">
                              <TabsTrigger value="speakers">Speakers</TabsTrigger>
                              <TabsTrigger value="history">History ({history.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="speakers" className="pt-3">
                              <div className="grid gap-2">
                                {speakers.map((row) => (
                                  <SpeakerCard
                                    key={row.contact.id}
                                    data={data}
                                    contact={row.contact}
                                    eventId={eventId}
                                  />
                                ))}
                              </div>
                            </TabsContent>
                            <TabsContent value="history" className="pt-3">
                              <div className="grid gap-2">
                                {history.map((entry) => (
                                  <details
                                    key={entry.id}
                                    className="rounded-md border bg-background"
                                  >
                                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
                                      <HistoryIcon className="size-3.5" />
                                      {entry.authorName} · {entry.changedFields.join(", ")}
                                      <span className="ml-auto capitalize text-muted-foreground">
                                        {entry.approvalStatus.replace("_", " ")}
                                      </span>
                                    </summary>
                                    <div className="border-t p-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => restore.mutate(entry.id)}
                                      >
                                        <RotateCcwIcon /> Restore
                                      </Button>
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

const dietaryLabels: Readonly<Record<string, string>> = {
  none: "No dietary needs",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  other: "Dietary: other",
};

function SpeakerCard({
  data,
  contact,
  eventId,
}: {
  readonly data: AdminData;
  readonly contact: AdminData["participants"][number]["contact"];
  readonly eventId: string;
}) {
  const headshot = data.files.find(
    (row) => row.contact.id === contact.id && row.upload.kind === "headshot",
  );
  const versions = data.versions
    .map((item) => item.version)
    .filter((version) => version.fileUploadId === headshot?.upload.id);
  const current = [...versions].sort(
    (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
  )[0];
  const image = useQuery({
    queryKey: ["admin-headshot", current?.id],
    queryFn: () => dataUrlForVersion(current!.id),
    enabled: current !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const meta = [
    dietaryLabels[contact.dietaryRequirements] ?? contact.dietaryRequirements,
    contact.tshirtSize === null ? null : `T-shirt ${contact.tshirtSize}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-start gap-3 p-3">
        {(image.data ?? contact.headshotUrl) ? (
          <img
            src={image.data ?? contact.headshotUrl ?? undefined}
            alt=""
            className="size-10 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
            {contact.firstName[0]}
            {contact.lastName[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium">
              {contact.firstName} {contact.lastName}
            </p>
            <p className="shrink-0 text-xs text-muted-foreground">{meta}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
          {contact.bio === null || contact.bio.length === 0 ? (
            <p className="mt-2 text-xs italic text-muted-foreground/70">No bio yet.</p>
          ) : (
            <div
              className="mt-2 text-xs leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: contact.bio }}
            />
          )}
        </div>
      </div>
      {headshot === undefined ? null : (
        <div className="border-t p-3">
          <FileThread
            eventId={eventId}
            upload={headshot.upload}
            versions={versions}
            comments={data.comments
              .map((item) => item.comment)
              .filter((comment) => comment.fileUploadId === headshot.upload.id)}
          />
        </div>
      )}
    </div>
  );
}

const formatJson = (value: import("effect").Schema.Json | undefined) =>
  typeof value === "string" ? value.replace(/<[^>]+>/g, "") : JSON.stringify(value, null, 2);

function downloadCsv(filename: string, rows: ReadonlyArray<Readonly<Record<string, string>>>) {
  const headers = Object.keys(rows[0] ?? {});
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [
    headers.map(quote).join(","),
    ...rows.map((row) => headers.map((header) => quote(row[header] ?? "")).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
