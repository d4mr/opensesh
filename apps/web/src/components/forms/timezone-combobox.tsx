import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const fallbackTimezones = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const timezones = Array.from(
  new Set([
    "UTC",
    ...(typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : fallbackTimezones),
  ]),
);

const offset = (timezone: string) => {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  if (name === undefined || name === "GMT") return "UTC";
  return name.replace("GMT", "UTC");
};

const groupedTimezones = new Map<string, Array<string>>();
for (const timezone of timezones) {
  const region = timezone.split("/")[0] ?? "Other";
  groupedTimezones.set(region, [...(groupedTimezones.get(region) ?? []), timezone]);
}
const groups = Array.from(groupedTimezones).sort(([left], [right]) => left.localeCompare(right));

export function TimezoneCombobox({
  value,
  onChange,
  id,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly id?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentOffset = useMemo(() => offset(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className="truncate">{value}</span>
          <span className="ml-auto text-xs text-muted-foreground">{currentOffset}</span>
          <ChevronsUpDownIcon className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            {groups.map(([region, zones]) => (
              <CommandGroup key={region} heading={region}>
                {zones.map((timezone) => (
                  <CommandItem
                    key={timezone}
                    value={`${timezone} ${offset(timezone)}`}
                    onSelect={() => {
                      onChange(timezone);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn("size-3.5", value === timezone ? "opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0 flex-1 truncate">{timezone}</span>
                    <span className="text-xs text-muted-foreground">{offset(timezone)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
