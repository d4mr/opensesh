import type { Event } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateEventSettings } from "@/server-fns/admin";

export const Route = createFileRoute("/admin/settings/event")({ component: EventSettings });

const dateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function EventSettings() {
  const context = useAdminEvent();
  if (context === null) return null;
  return <EventSettingsForm key={context.event.id} event={context.event} />;
}

function EventSettingsForm({ event }: { readonly event: Event }) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: event.name,
      tagline: event.tagline ?? "",
      description: event.description ?? "",
      startsAt: dateInput(event.startsAt),
      endsAt: dateInput(event.endsAt),
      timezone: event.timezone,
      location: event.location ?? "",
    },
    onSubmit: async ({ value }) => {
      const result = await updateEventSettings({
        data: {
          eventId: event.id,
          ...value,
          tagline: value.tagline || null,
          description: value.description || null,
          location: value.location || null,
        },
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
  });

  return (
    <main className="flex-1 p-4 text-sm lg:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Event details</h1>
        <p className="text-sm text-muted-foreground">Name, dates, timezone, and public context.</p>
      </div>
      <Card className="max-w-3xl py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm">Basics</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Event name</FieldLabel>
                  <Input
                    id={field.name}
                    required
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="tagline">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Tagline</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="startsAt">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Starts</FieldLabel>
                  <Input
                    id={field.name}
                    type="datetime-local"
                    required
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="endsAt">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Ends</FieldLabel>
                  <Input
                    id={field.name}
                    type="datetime-local"
                    required
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="timezone">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Timezone</FieldLabel>
                  <Input
                    id={field.name}
                    required
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="location">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    id={field.name}
                    rows={5}
                    value={field.state.value}
                    onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <div className="sm:col-span-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : "Save"}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
