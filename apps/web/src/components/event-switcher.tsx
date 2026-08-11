import type { Event } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlusIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { EventIcon } from "@/components/app/event-icon";
import { DateTimePicker } from "@/components/forms/datetime-picker";
import { EntityCombobox } from "@/components/forms/entity-combobox";
import { TimezoneCombobox } from "@/components/forms/timezone-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommandItem } from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { createEvent, searchAdminEvents } from "@/server-fns/admin";

const dateInput = (date: Date) => {
  return date.toISOString();
};

// Event-timezone formatting keeps SSR and browser output identical.
const formatDates = (event: Event) => {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  });
  return `${date.format(event.startsAt)}–${date.format(event.endsAt)}`;
};

export function EventSwitcher({
  event,
  events,
  dates,
  onSelect,
  onCreated,
  canCreate = true,
}: {
  readonly event: Event;
  readonly events: ReadonlyArray<Event>;
  readonly dates: string;
  readonly onSelect: (eventId: string) => void;
  readonly onCreated: (eventId: string) => Promise<void>;
  readonly canCreate?: boolean;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string>();
  const loadEvents = useCallback(
    async (query: string) => {
      const result = await searchAdminEvents({ data: { eventId: event.id, query } });
      return result.ok ? result.data : [];
    },
    [event.id],
  );
  const tomorrow = new Date(Date.now() + 86_400_000);
  const form = useForm({
    defaultValues: {
      name: "",
      startsAt: dateInput(tomorrow),
      endsAt: dateInput(new Date(tomorrow.getTime() + 86_400_000)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const result = await createEvent({ data: value });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await onCreated(result.data.id);
      setDialogOpen(false);
      await navigate({ to: "/admin/settings/event" });
    },
  });

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <EntityCombobox
            items={events}
            loadItems={loadEvents}
            value={event.id}
            onChange={onSelect}
            getItemText={(item) => `${item.name} ${formatDates(item)}`}
            searchPlaceholder="Search events…"
            emptyText="No events found."
            contentSide={isMobile ? "bottom" : "right"}
            contentClassName="min-w-64 rounded-lg"
            renderTrigger={({ open }) => (
              <SidebarMenuButton
                size="lg"
                role="combobox"
                aria-expanded={open}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <EventIcon src={event.logoUrl} size={32} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{event.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{dates}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            )}
            renderItem={(item) => (
              <div className="flex min-w-0 items-center gap-2">
                <EventIcon src={item.logoUrl} size={28} />
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDates(item)}
                  </span>
                </div>
              </div>
            )}
            renderValue={(item) => item.name}
            footer={
              canCreate ? (
                <CommandItem className="gap-2 p-2" onSelect={() => setDialogOpen(true)}>
                  <span className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <PlusIcon className="size-3.5" />
                  </span>
                  <span className="font-medium">Create event</span>
                </CommandItem>
              ) : undefined
            }
          />
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              void form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlusIcon className="size-4" /> New event
              </DialogTitle>
              <DialogDescription>
                Create the event now; add its program library next.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5 sm:grid-cols-2">
              <form.Field name="name">
                {(field) => (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      id={field.name}
                      required
                      autoFocus
                      value={field.state.value}
                      onChange={(inputEvent) => field.handleChange(inputEvent.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.timezone}>
                {(timezone) => (
                  <>
                    <form.Field name="startsAt">
                      {(field) => (
                        <Field>
                          <FieldLabel>Starts</FieldLabel>
                          <DateTimePicker
                            value={field.state.value}
                            timezone={timezone}
                            onChange={field.handleChange}
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
              {error === undefined ? null : (
                <FieldDescription className="sm:col-span-2 text-destructive">
                  {error}
                </FieldDescription>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create event"}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
