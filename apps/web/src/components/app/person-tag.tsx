import type * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

// Forwards span props (and ref) so Radix `asChild` triggers — HoverCardTrigger
// in particular — can attach listeners directly to the tag.
export function PersonTag({
  person,
  className,
  ...props
}: {
  readonly person: { readonly name: string; readonly image: string | null } | null;
} & React.ComponentProps<"span">) {
  if (person === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
          className,
        )}
        {...props}
      >
        <span className="size-4 rounded-full bg-muted-foreground/15" aria-hidden="true" />
        Unassigned
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    >
      <Avatar className="size-4">
        {person.image === null ? null : <AvatarImage src={person.image} alt="" />}
        <AvatarFallback className="text-[8px]">{initials(person.name)}</AvatarFallback>
      </Avatar>
      {person.name}
    </span>
  );
}
