import { CalendarIcon, Clock3Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const zonedParts = (value: string, timezone: string): ZonedParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
  };
};

const zonedIso = (date: string, minutes: number, timezone: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const desired = Date.UTC(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    Math.floor(minutes / 60),
    minutes % 60,
  );
  let guess = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const represented = zonedParts(new Date(guess).toISOString(), timezone);
    guess +=
      desired -
      Date.UTC(
        represented.year,
        represented.month - 1,
        represented.day,
        represented.hour,
        represented.minute,
      );
  }
  return new Date(guess).toISOString();
};

export const timezoneAbbreviation = (timezone: string, value = new Date().toISOString()) =>
  new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
    .formatToParts(new Date(value))
    .find((part) => part.type === "timeZoneName")?.value ?? timezone;

export const formatDateTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  const hour = Math.floor(minutes / 60);
  return {
    value: String(minutes),
    label: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
      new Date(2020, 0, 1, hour, minutes % 60),
    ),
  };
});

export function DateTimePicker({
  value,
  timezone,
  onChange,
  placeholder = "Choose date and time",
  id,
  disabled,
  className,
}: {
  readonly value: string;
  readonly timezone: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly id?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = useMemo(
    () => (value.length === 0 ? null : zonedParts(value, timezone)),
    [timezone, value],
  );
  const selected =
    current === null ? undefined : new Date(current.year, current.month - 1, current.day);
  const minutes = current === null ? 9 * 60 : current.hour * 60 + current.minute;

  const update = (date: Date, nextMinutes: number) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(zonedIso(key, nextMinutes, timezone));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start px-3 text-left font-normal",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">
            {value.length === 0 ? placeholder : formatDateTime(value, timezone)}
          </span>
          <span className="rounded-sm border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {timezoneAbbreviation(timezone, value || undefined)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date !== undefined) update(date, minutes);
          }}
        />
        <div className="flex h-12 items-center gap-2 border-t px-3">
          <Clock3Icon className="size-3.5 text-muted-foreground" />
          <Select
            value={String(minutes)}
            onValueChange={(next) => {
              const date = selected ?? new Date();
              update(date, Number(next));
            }}
          >
            <SelectTrigger className="h-8 min-w-32 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {timeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="rounded-sm border bg-muted/40 px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
            {timezoneAbbreviation(timezone, value || undefined)}
          </span>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
