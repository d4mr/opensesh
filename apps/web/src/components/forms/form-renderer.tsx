import type {
  FormAnswers,
  FormFieldDefinition,
  FormRendererAnswers,
  Format,
  Level,
  Tag,
  Track,
} from "@opensesh/domain";
import { isFormFieldVisible, makeFormAnswersSchema } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { RichTextEditor } from "@/components/forms/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface FormRendererLibrary {
  readonly tracks: ReadonlyArray<Track>;
  readonly formats: ReadonlyArray<Format>;
  readonly tags: ReadonlyArray<Tag>;
  readonly levels: ReadonlyArray<Level>;
}

const valuesForField = (field: FormFieldDefinition, library: FormRendererLibrary) => {
  if (field.options === null) return [];
  if ("custom" in field.options) {
    return field.options.custom.map((name) => ({ id: name, name }));
  }
  if (field.options.bind === "track") return library.tracks;
  if (field.options.bind === "format") {
    return library.formats.map((format) => ({
      id: format.id,
      name: `${format.name} (${format.durationMinutes} min)`,
    }));
  }
  if (field.options.bind === "tags") return library.tags;
  return library.levels;
};

const initialAnswers = (fields: ReadonlyArray<FormFieldDefinition>, answers: FormAnswers) => {
  const initial: Record<string, string | ReadonlyArray<string>> = {};
  for (const field of fields) {
    const value = answers[field.id];
    initial[field.id] =
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : field.fieldType === "checkbox"
            ? []
            : "";
  }
  return initial satisfies FormRendererAnswers;
};

const errorMessage = (errors: ReadonlyArray<unknown>) => {
  const first = errors[0];
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null && "message" in first) {
    const message = first.message;
    return typeof message === "string" ? message : "Check this field";
  }
  return errors.length > 0 ? "Check this field" : undefined;
};

export function FormRenderer({
  fields,
  library,
  answers,
  onAnswersChange,
  onContinue,
  continueLabel = "Continue",
  showContinue = true,
}: {
  readonly fields: ReadonlyArray<FormFieldDefinition>;
  readonly library: FormRendererLibrary;
  readonly answers: FormAnswers;
  readonly onAnswersChange: (answers: FormAnswers) => void;
  readonly onContinue: () => void | Promise<void>;
  readonly continueLabel?: string;
  readonly showContinue?: boolean;
}) {
  const form = useForm({
    defaultValues: initialAnswers(fields, answers),
    validators: { onSubmit: Schema.toStandardSchemaV1(makeFormAnswersSchema(fields)) },
    onSubmit: async () => onContinue(),
  });
  const update = (fieldId: string, value: string | ReadonlyArray<string>) => {
    onAnswersChange({ ...form.state.values, [fieldId]: value });
  };
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.values}>
        {(currentAnswers) => (
          <>
            {fields.map((definition) => {
              const visible = isFormFieldVisible(definition, currentAnswers);
              const options = valuesForField(definition, library);
              return (
                <div
                  key={definition.id}
                  aria-hidden={!visible}
                  className={cn("conditional-field", visible && "conditional-field-visible")}
                >
                  <div className="min-h-0 overflow-hidden">
                    <form.Field name={definition.id}>
                      {(field) => {
                        const message = errorMessage(field.state.meta.errors);
                        const textValue =
                          typeof field.state.value === "string" ? field.state.value : "";
                        const arrayValue = Array.isArray(field.state.value)
                          ? field.state.value.filter(
                              (item): item is string => typeof item === "string",
                            )
                          : [];
                        return (
                          <Field data-invalid={message !== undefined} className="pb-1">
                            <div className="flex items-center justify-between gap-3">
                              <FieldLabel htmlFor={field.name}>
                                {definition.label}
                                {definition.required ? " *" : ""}
                              </FieldLabel>
                              {definition.maxChars === null ? null : (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {textValue.length}/{definition.maxChars}
                                </span>
                              )}
                            </div>
                            {definition.fieldType === "textarea" ? (
                              <Textarea
                                id={field.name}
                                rows={5}
                                maxLength={definition.maxChars ?? undefined}
                                value={textValue}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                  update(definition.id, event.target.value);
                                }}
                              />
                            ) : definition.fieldType === "richtext" ? (
                              <RichTextEditor
                                value={textValue}
                                onChange={(value) => {
                                  field.handleChange(value);
                                  update(definition.id, value);
                                }}
                              />
                            ) : definition.fieldType === "dropdown" ? (
                              <Select
                                value={textValue}
                                onValueChange={(value) => {
                                  field.handleChange(value);
                                  update(definition.id, value);
                                }}
                              >
                                <SelectTrigger id={field.name} className="w-full">
                                  <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : definition.fieldType === "checkbox" ? (
                              <div className="grid gap-2 rounded-md border p-3">
                                {options.length === 0 ? (
                                  <label className="flex items-center gap-2">
                                    <Checkbox
                                      checked={arrayValue.includes("true")}
                                      onCheckedChange={(checked) => {
                                        const value = checked ? ["true"] : [];
                                        field.handleChange(value);
                                        update(definition.id, value);
                                      }}
                                    />{" "}
                                    Yes
                                  </label>
                                ) : (
                                  options.map((option) => (
                                    <label
                                      key={option.id}
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <Checkbox
                                        checked={arrayValue.includes(option.id)}
                                        onCheckedChange={(checked) => {
                                          const value = checked
                                            ? [...arrayValue, option.id]
                                            : arrayValue.filter((id) => id !== option.id);
                                          field.handleChange(value);
                                          update(definition.id, value);
                                        }}
                                      />
                                      {option.name}
                                    </label>
                                  ))
                                )}
                              </div>
                            ) : (
                              <Input
                                id={field.name}
                                type={
                                  definition.fieldType === "email"
                                    ? "email"
                                    : definition.fieldType === "phone"
                                      ? "tel"
                                      : "text"
                                }
                                maxLength={definition.maxChars ?? undefined}
                                value={textValue}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                  update(definition.id, event.target.value);
                                }}
                              />
                            )}
                            {message === undefined ? null : (
                              <FieldDescription className="text-destructive">
                                {message}
                              </FieldDescription>
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </form.Subscribe>
      {showContinue ? (
        <div className="flex justify-end border-t pt-4">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Checking…" : continueLabel}
              </Button>
            )}
          </form.Subscribe>
        </div>
      ) : null}
    </form>
  );
}
