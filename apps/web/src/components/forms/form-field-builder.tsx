import type {
  FormFieldReplacement,
  FormFieldType,
  FormLibraryBinding,
  FormSection,
} from "@opensesh/domain";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  GripVerticalIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { DateTimePicker } from "@/components/forms/datetime-picker";
import type { FormRendererLibrary } from "@/components/forms/form-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const fieldTypes: ReadonlyArray<FormFieldType> = [
  "text",
  "textarea",
  "richtext",
  "email",
  "phone",
  "dropdown",
  "checkbox",
  "datetime",
];

const fieldTypeLabels: Readonly<Record<FormFieldType, string>> = {
  text: "Short text",
  textarea: "Long text",
  richtext: "Rich text",
  email: "Email",
  phone: "Phone",
  dropdown: "Dropdown",
  checkbox: "Checkboxes",
  datetime: "Date and time",
  file: "File upload",
};

const bindingMapsTo: Readonly<Record<FormLibraryBinding, string>> = {
  format: "format_id",
  track: "tracks",
  tags: "tags",
  level: "level_id",
};

const parseFieldType = (value: string): FormFieldType => {
  switch (value) {
    case "textarea":
    case "richtext":
    case "email":
    case "phone":
    case "dropdown":
    case "checkbox":
    case "datetime":
      return value;
    default:
      return "text";
  }
};

const parseBinding = (value: string): FormLibraryBinding => {
  switch (value) {
    case "format":
    case "track":
    case "tags":
    case "level":
      return value;
    default:
      return "track";
  }
};

export type EditorFormField = FormFieldReplacement & { readonly id: string };

const fieldId = (field: EditorFormField) => field.id;

// Borderless select trigger so condition clauses read as an editable sentence.
const clauseTrigger =
  "h-7 w-fit min-w-0 max-w-52 gap-1 truncate rounded-md border-0 bg-transparent px-1.5 text-[13px] font-medium shadow-none transition-colors hover:bg-muted/60 data-[state=open]:bg-muted/60 dark:bg-transparent dark:hover:bg-muted/60";

// Answers store option ids (library ids or custom labels), so condition
// values must be picked from the source field's options — typed labels like
// "Workshop" would never match the stored "fmt_…" id.
const conditionValueOptions = (
  field: EditorFormField | undefined,
  library: FormRendererLibrary,
): ReadonlyArray<{ id: string; name: string }> => {
  if (field === undefined || field.options === null) return [];
  if ("custom" in field.options) return field.options.custom.map((name) => ({ id: name, name }));
  if (!("bind" in field.options)) return [];
  if (field.options.bind === "track") return library.tracks;
  if (field.options.bind === "format") return library.formats;
  if (field.options.bind === "tags") return library.tags;
  return library.levels;
};

export function FormFieldBuilder({
  section,
  fields,
  onChange,
  timezone,
  library,
}: {
  readonly section: FormSection;
  readonly fields: ReadonlyArray<EditorFormField>;
  readonly onChange: (fields: ReadonlyArray<EditorFormField>) => void;
  readonly timezone: string;
  readonly library: FormRendererLibrary;
}) {
  const sectionFields = fields.filter((field) => field.section === section);
  const [dragMotion, setDragMotion] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const update = (id: string, next: EditorFormField) =>
    onChange(fields.map((field) => (fieldId(field) === id ? next : field)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= sectionFields.length) return;
    const reordered = arrayMove(sectionFields, from, to).map((field, index) => ({
      ...field,
      position: index + 1,
    }));
    const other = fields.filter((field) => field.section !== section);
    onChange(section === "abstract" ? [...reordered, ...other] : [...other, ...reordered]);
  };
  const dragEnd = (event: DragEndEvent) => {
    if (event.over === null || event.active.id === event.over.id) {
      setDragMotion(false);
      return;
    }
    const from = sectionFields.findIndex((field) => fieldId(field) === String(event.active.id));
    const to = sectionFields.findIndex((field) => fieldId(field) === String(event.over?.id));
    if (from >= 0 && to >= 0) move(from, to);
    window.setTimeout(() => setDragMotion(false), 150);
  };
  const add = () => {
    const next: EditorFormField = {
      id: crypto.randomUUID(),
      section,
      label: "New question",
      fieldType: "text",
      maxChars: 255,
      required: false,
      locked: false,
      position: sectionFields.length + 1,
      options: null,
      mapsTo: null,
      condition: null,
    };
    onChange([...fields, next]);
  };
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Questions
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sectionFields.length} {sectionFields.length === 1 ? "question" : "questions"}
        </span>
      </div>
      <DndContext
        id="form-field-builder-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => setDragMotion(!reduceMotion)}
        onDragCancel={() => setDragMotion(false)}
        onDragEnd={dragEnd}
      >
        <SortableContext items={sectionFields.map(fieldId)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {sectionFields.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground">
                No questions yet. Add the first one below.
              </div>
            ) : null}
            {sectionFields.map((field, index) => (
              <SortableField
                key={fieldId(field)}
                field={field}
                animate={dragMotion}
                candidates={sectionFields.filter(
                  (candidate) => fieldId(candidate) !== fieldId(field),
                )}
                onChange={(next) => update(fieldId(field), next)}
                timezone={timezone}
                library={library}
                onRemove={() =>
                  onChange(fields.filter((candidate) => fieldId(candidate) !== fieldId(field)))
                }
                moveUp={() => move(index, index - 1)}
                moveDown={() => move(index, index + 1)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        size="sm"
        variant="ghost"
        className="pressable mt-2 text-muted-foreground"
        onClick={add}
      >
        <PlusIcon /> Add question
      </Button>
    </div>
  );
}

function SortableField({
  field,
  animate,
  candidates,
  onChange,
  onRemove,
  moveUp,
  moveDown,
  timezone,
  library,
}: {
  readonly field: EditorFormField;
  readonly animate: boolean;
  readonly candidates: ReadonlyArray<EditorFormField>;
  readonly onChange: (field: EditorFormField) => void;
  readonly onRemove: () => void;
  readonly moveUp: () => void;
  readonly moveDown: () => void;
  readonly timezone: string;
  readonly library: FormRendererLibrary;
}) {
  const id = fieldId(field);
  const sortable = useSortable({
    id,
    transition: animate ? { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } : null,
  });
  const customOptions =
    field.options !== null && "custom" in field.options ? field.options.custom.join(", ") : "";
  const binding = field.options !== null && "bind" in field.options ? field.options.bind : null;
  const bounds = field.options !== null && "min" in field.options ? field.options : null;
  const hasChars =
    field.fieldType !== "checkbox" &&
    field.fieldType !== "dropdown" &&
    field.fieldType !== "datetime";
  const conditionSource =
    field.condition === null
      ? undefined
      : candidates.find((candidate) => fieldId(candidate) === field.condition?.fieldId);
  const conditionChoices = conditionValueOptions(conditionSource, library);
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex h-10 items-center gap-1 border-b bg-muted/40 pr-1.5 pl-1.5">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Drag ${field.label}`}
          className="hidden shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground md:block"
          {...sortable.listeners}
        >
          <GripVerticalIcon className="size-3.5" />
        </button>
        <Input
          aria-label="Question label"
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[13px] font-medium shadow-none focus-visible:bg-background dark:bg-transparent"
          disabled={field.locked}
          value={field.label}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
        />
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          {field.locked ? <LockIcon className="mx-1.5 size-3.5" /> : null}
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label="Move up"
            onClick={moveUp}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label="Move down"
            onClick={moveDown}
          >
            <ChevronDownIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label="Remove field"
            disabled={field.locked}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              disabled={field.locked}
              value={field.fieldType}
              onValueChange={(value) => {
                const type = parseFieldType(value);
                onChange({
                  ...field,
                  fieldType: type,
                  options:
                    type === "dropdown" || type === "checkbox"
                      ? { custom: [] }
                      : type === "datetime"
                        ? { min: null, max: null }
                        : null,
                  maxChars: type === "datetime" ? null : field.maxChars,
                  mapsTo: null,
                });
              }}
            >
              <SelectTrigger size="sm" className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {fieldTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasChars ? (
            <div className="grid gap-1">
              <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
                Max chars
              </Label>
              <Input
                id={`${id}-max`}
                className="h-8 w-24"
                type="number"
                min={1}
                disabled={field.locked}
                value={field.maxChars ?? ""}
                onChange={(event) =>
                  onChange({ ...field, maxChars: event.target.valueAsNumber || null })
                }
              />
            </div>
          ) : null}
          {field.fieldType === "dropdown" || field.fieldType === "checkbox" ? (
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Options</Label>
              <Select
                value={binding ?? "custom"}
                onValueChange={(value) => {
                  if (value === "custom") {
                    onChange({ ...field, options: { custom: [] }, mapsTo: null });
                    return;
                  }
                  const bind = parseBinding(value);
                  onChange({ ...field, options: { bind }, mapsTo: bindingMapsTo[bind] });
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-40">
                  <SelectValue placeholder="Options source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom options</SelectItem>
                  <SelectItem value="format">Format library</SelectItem>
                  <SelectItem value="track">Track library</SelectItem>
                  <SelectItem value="tags">Tags library</SelectItem>
                  <SelectItem value="level">Level library</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="ml-auto flex h-8 items-center gap-2">
            <Label htmlFor={`${id}-required`} className="text-[13px] text-muted-foreground">
              Required
            </Label>
            <Switch
              id={`${id}-required`}
              checked={field.required}
              disabled={field.locked}
              onCheckedChange={(required) => onChange({ ...field, required })}
            />
          </div>
        </div>
        {(field.fieldType === "dropdown" || field.fieldType === "checkbox") && binding === null ? (
          <div className="grid gap-1">
            <Label htmlFor={`${id}-options`} className="text-xs text-muted-foreground">
              Custom options
            </Label>
            <Input
              id={`${id}-options`}
              className="h-8"
              placeholder="Option one, Option two"
              value={customOptions}
              onChange={(event) =>
                onChange({
                  ...field,
                  options: {
                    custom: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
        ) : null}
        {field.fieldType === "datetime" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Earliest date and time</Label>
                {bounds?.min === null || bounds === null ? null : (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => onChange({ ...field, options: { min: null, max: bounds.max } })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <DateTimePicker
                value={bounds?.min ?? ""}
                timezone={timezone}
                placeholder="No minimum"
                onChange={(min) =>
                  onChange({ ...field, options: { min, max: bounds?.max ?? null } })
                }
              />
            </div>
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Latest date and time</Label>
                {bounds?.max === null || bounds === null ? null : (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => onChange({ ...field, options: { min: bounds.min, max: null } })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <DateTimePicker
                value={bounds?.max ?? ""}
                timezone={timezone}
                placeholder="No maximum"
                onChange={(max) =>
                  onChange({ ...field, options: { min: bounds?.min ?? null, max } })
                }
              />
            </div>
          </div>
        ) : null}
        {field.condition === null ? (
          candidates.length > 0 ? (
            <div>
              <Button
                size="xs"
                variant="ghost"
                className="pressable -ml-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const source = candidates[0];
                  if (source === undefined) return;
                  onChange({
                    ...field,
                    condition: { fieldId: fieldId(source), operator: "equals", values: [] },
                  });
                }}
              >
                <EyeIcon /> Always shown — add condition
              </Button>
            </div>
          ) : null
        ) : (
          <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted/40 py-1 pr-1 pl-2.5 text-[13px]">
            <EyeIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Show when</span>
            <Select
              value={field.condition.fieldId}
              onValueChange={(fieldIdValue) =>
                onChange({
                  ...field,
                  condition: {
                    fieldId: fieldIdValue,
                    operator: field.condition?.operator ?? "equals",
                    // Old values belong to the previous source field's options.
                    values: fieldIdValue === field.condition?.fieldId ? field.condition.values : [],
                  },
                })
              }
            >
              <SelectTrigger size="sm" aria-label="Condition question" className={clauseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={fieldId(candidate)} value={fieldId(candidate)}>
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={field.condition.operator}
              onValueChange={(operator) =>
                onChange({
                  ...field,
                  condition: {
                    fieldId: field.condition?.fieldId ?? "",
                    operator: operator === "is_one_of" ? "is_one_of" : "equals",
                    values: field.condition?.values ?? [],
                  },
                })
              }
            >
              <SelectTrigger size="sm" aria-label="Condition operator" className={clauseTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">is</SelectItem>
                <SelectItem value="is_one_of">is any of</SelectItem>
              </SelectContent>
            </Select>
            {conditionChoices.length > 0 && field.condition.operator === "equals" ? (
              <Select
                value={field.condition.values[0] ?? ""}
                onValueChange={(value) =>
                  onChange({
                    ...field,
                    condition: {
                      fieldId: field.condition?.fieldId ?? "",
                      operator: "equals",
                      values: [value],
                    },
                  })
                }
              >
                <SelectTrigger size="sm" aria-label="Condition value" className={clauseTrigger}>
                  <SelectValue placeholder="choose an option" />
                </SelectTrigger>
                <SelectContent>
                  {conditionChoices.map((choice) => (
                    <SelectItem key={choice.id} value={choice.id}>
                      {choice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : conditionChoices.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {conditionChoices.map((choice) => {
                  const active = field.condition?.values.includes(choice.id) === true;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "pressable h-6 rounded-md px-2 text-xs transition-colors",
                        active
                          ? "bg-background font-medium text-foreground ring-1 ring-border"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                      onClick={() =>
                        onChange({
                          ...field,
                          condition: {
                            fieldId: field.condition?.fieldId ?? "",
                            operator: field.condition?.operator ?? "is_one_of",
                            values: active
                              ? (field.condition?.values ?? []).filter(
                                  (value) => value !== choice.id,
                                )
                              : [...(field.condition?.values ?? []), choice.id],
                          },
                        })
                      }
                    >
                      {choice.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input
                aria-label="Condition value"
                className="h-7 w-44 bg-background text-[13px]"
                placeholder="Value, another value"
                value={field.condition.values.join(", ")}
                onChange={(event) =>
                  onChange({
                    ...field,
                    condition: {
                      fieldId: field.condition?.fieldId ?? "",
                      operator: field.condition?.operator ?? "equals",
                      values: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto self-start text-muted-foreground"
              aria-label="Remove condition"
              onClick={() => onChange({ ...field, condition: null })}
            >
              <XIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
