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

const fieldId = (field: FormFieldReplacement) => field.id ?? `${field.section}-${field.position}`;

// Answers store option ids (library ids or custom labels), so condition
// values must be picked from the source field's options — typed labels like
// "Workshop" would never match the stored "fmt_…" id.
const conditionValueOptions = (
  field: FormFieldReplacement | undefined,
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
  readonly fields: ReadonlyArray<FormFieldReplacement>;
  readonly onChange: (fields: ReadonlyArray<FormFieldReplacement>) => void;
  readonly timezone: string;
  readonly library: FormRendererLibrary;
}) {
  const sectionFields = fields.filter((field) => field.section === section);
  const [dragMotion, setDragMotion] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const update = (id: string, next: FormFieldReplacement) =>
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
    const next: FormFieldReplacement = {
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Form questions</p>
        <Button size="sm" variant="outline" onClick={add}>
          <PlusIcon /> Add field
        </Button>
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
  readonly field: FormFieldReplacement;
  readonly animate: boolean;
  readonly candidates: ReadonlyArray<FormFieldReplacement>;
  readonly onChange: (field: FormFieldReplacement) => void;
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
      className="rounded-md border bg-card p-3"
    >
      <div className="grid gap-3 md:grid-cols-[auto_1fr_150px_92px_auto] md:items-end">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Drag ${field.label}`}
          className="hidden cursor-grab self-center text-muted-foreground md:block"
          {...sortable.listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-label`}>Label</Label>
          <Input
            id={`${id}-label`}
            className="h-8"
            disabled={field.locked}
            value={field.label}
            onChange={(event) => onChange({ ...field, label: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Type</Label>
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
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-max`}>Max chars</Label>
          <Input
            id={`${id}-max`}
            className="h-8"
            type="number"
            min={1}
            disabled={
              field.locked ||
              field.fieldType === "checkbox" ||
              field.fieldType === "dropdown" ||
              field.fieldType === "datetime"
            }
            value={field.maxChars ?? ""}
            onChange={(event) =>
              onChange({ ...field, maxChars: event.target.valueAsNumber || null })
            }
          />
        </div>
        <div className="flex items-center justify-end gap-1">
          {field.locked ? <LockIcon className="mr-1 size-3.5 text-muted-foreground" /> : null}
          <Button size="icon-sm" variant="ghost" aria-label="Move up" onClick={moveUp}>
            <ChevronUpIcon />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Move down" onClick={moveDown}>
            <ChevronDownIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove field"
            disabled={field.locked}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-3">
        <label className="flex h-8 items-center justify-between rounded-md border px-2.5 text-xs">
          Required
          <Switch
            checked={field.required}
            disabled={field.locked}
            onCheckedChange={(required) => onChange({ ...field, required })}
          />
        </label>
        {field.fieldType === "dropdown" || field.fieldType === "checkbox" ? (
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
            <SelectTrigger className="h-8 w-full">
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
        ) : (
          <div />
        )}
        {field.condition === null ? (
          <Select
            value="always"
            onValueChange={(value) => {
              if (value !== "always") {
                onChange({
                  ...field,
                  condition: { fieldId: value, operator: "equals", values: [] },
                });
              }
            }}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Always shown" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always shown</SelectItem>
              {candidates.map((candidate) => (
                <SelectItem key={fieldId(candidate)} value={fieldId(candidate)}>
                  Show when {candidate.label}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-1">
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
              <SelectTrigger className="h-8 min-w-0 flex-1">
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
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="is_one_of">Is one of</SelectItem>
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
                <SelectTrigger aria-label="Condition value" className="h-8 min-w-0 flex-1">
                  <SelectValue placeholder="Choose option" />
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
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                {conditionChoices.map((choice) => {
                  const active = field.condition?.values.includes(choice.id) === true;
                  return (
                    <Button
                      key={choice.id}
                      size="sm"
                      variant={active ? "secondary" : "outline"}
                      className="h-7 px-2 text-xs"
                      aria-pressed={active}
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
                    </Button>
                  );
                })}
              </div>
            ) : (
              <Input
                aria-label="Condition value"
                className="h-8 min-w-0 flex-1"
                placeholder="equals value"
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
              size="icon-sm"
              variant="ghost"
              aria-label="Remove condition"
              onClick={() => onChange({ ...field, condition: null })}
            >
              <XIcon />
            </Button>
          </div>
        )}
      </div>
      {(field.fieldType === "dropdown" || field.fieldType === "checkbox") && binding === null ? (
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor={`${id}-options`}>Custom options</Label>
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
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Earliest date and time</Label>
              {bounds?.min === null || bounds === null ? null : (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
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
              onChange={(min) => onChange({ ...field, options: { min, max: bounds?.max ?? null } })}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Latest date and time</Label>
              {bounds?.max === null || bounds === null ? null : (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
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
              onChange={(max) => onChange({ ...field, options: { min: bounds?.min ?? null, max } })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
