import { timezoneAbbreviation } from "@/components/forms/datetime-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The one way a timezone is indicated next to times and time controls — the
// same chip the datetime picker renders, plus the pointer to where the
// timezone actually lives.
export function TimezoneChip({ timezone }: { readonly timezone: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="rounded-sm border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {timezoneAbbreviation(timezone)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        Times are in the event timezone, {timezone}. Change it in Event Settings.
      </TooltipContent>
    </Tooltip>
  );
}
