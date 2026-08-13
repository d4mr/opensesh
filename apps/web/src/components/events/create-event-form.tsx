import type { EventType } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useLayoutEffect, useState } from "react";

import { DateTimePicker } from "@/components/forms/datetime-picker";
import { TimezoneCombobox } from "@/components/forms/timezone-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEvent } from "@/server-fns/admin";

// On the hour so the quarter-hour time select has a matching option to show.
const tomorrow = () => {
  const date = new Date(Date.now() + 86_400_000);
  date.setMinutes(0, 0, 0);
  return date;
};

// The defaults below read the clock and the browser timezone, which SSR (UTC
// workerd) and the client disagree on — a live hydration-mismatch source when
// this form renders in the zero-events empty state. Mount-gate it: SSR and the
// first client render both paint nothing, then the real form lands pre-paint.
export function CreateEventForm(props: {
  readonly onCreated: (eventId: string) => Promise<void>;
  readonly onCancel?: () => void;
  readonly submitLabel?: string;
}) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => setReady(true), []);
  return ready ? <CreateEventFormInner {...props} /> : null;
}

function CreateEventFormInner({
  onCreated,
  onCancel,
  submitLabel = "Create event",
}: {
  readonly onCreated: (eventId: string) => Promise<void>;
  readonly onCancel?: () => void;
  readonly submitLabel?: string;
}) {
  const [error, setError] = useState<string>();
  const start = tomorrow();
  const form = useForm({
    defaultValues: {
      name: "",
      type: "conference" as EventType,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 86_400_000).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      if (new Date(value.endsAt) <= new Date(value.startsAt)) {
        setError("Event end must be after the start.");
        return;
      }
      const result = await createEvent({ data: value });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await onCreated(result.data.id);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="wizard-fields grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                id={field.name}
                required
                autoFocus
                placeholder="Open Source Summit"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <Field className="sm:col-span-2">
              <FieldLabel>Type</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(value) => {
                  if (value === "conference" || value === "summit" || value === "meetup") {
                    field.handleChange(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="summit">Summit</SelectItem>
                  <SelectItem value="meetup">Meetup</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [state.values.timezone, state.values.startsAt] as const}
        >
          {([timezone, startsAt]) => (
            <>
              <form.Field name="startsAt">
                {(field) => (
                  <Field>
                    <FieldLabel>Starts</FieldLabel>
                    <DateTimePicker
                      value={field.state.value}
                      timezone={timezone}
                      onChange={(next) => {
                        field.handleChange(next);
                        // Keep the range valid: a start moved past the end
                        // drags the end along to one day later.
                        if (new Date(form.getFieldValue("endsAt")) <= new Date(next)) {
                          form.setFieldValue(
                            "endsAt",
                            new Date(new Date(next).getTime() + 86_400_000).toISOString(),
                          );
                        }
                      }}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="endsAt">
                {(field) => (
                  <Field>
                    <FieldLabel>Ends</FieldLabel>
                    <DateTimePicker
                      value={field.state.value}
                      timezone={timezone}
                      minIso={startsAt}
                      onChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>
            </>
          )}
        </form.Subscribe>
        <form.Field name="timezone">
          {(field) => (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={field.name}>Timezone</FieldLabel>
              <TimezoneCombobox
                id={field.name}
                value={field.state.value}
                onChange={field.handleChange}
              />
            </Field>
          )}
        </form.Field>
      </div>
      {error === undefined ? null : (
        <FieldDescription className="mt-3 text-destructive">{error}</FieldDescription>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t pt-4">
        {onCancel === undefined ? null : (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button className="pressable" type="submit" disabled={submitting}>
              {submitting ? "Creating…" : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
