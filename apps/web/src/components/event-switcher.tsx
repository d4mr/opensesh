import type { Event } from "@opensesh/domain";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CalendarPlusIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { createEvent } from "@/server-fns/admin";

const dateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const formatDates = (event: Event) => {
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${date.format(event.startsAt)}–${date.format(event.endsAt)}`;
};

export function EventSwitcher({
  event,
  events,
  dates,
  onSelect,
  onCreated,
}: {
  readonly event: Event;
  readonly events: ReadonlyArray<Event>;
  readonly dates: string;
  readonly onSelect: (eventId: string) => void;
  readonly onCreated: (eventId: string) => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string>();
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <BrandMark />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{event.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{dates}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Events
              </DropdownMenuLabel>
              {events.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className="gap-2 p-2"
                  onSelect={() => onSelect(item.id)}
                >
                  <BrandMark className="size-6 rounded-md" />
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDates(item)}
                    </span>
                  </div>
                  {item.id === event.id ? <CheckIcon className="size-4 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onSelect={() => setDialogOpen(true)}>
                <span className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <PlusIcon className="size-3.5" />
                </span>
                <span className="font-medium">Create event</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <Field className="sm:col-span-2">
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
