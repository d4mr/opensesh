import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PersonHoverCard, type PersonPopoverData } from "@/components/app/person-popover";

// The one speaker identity row used everywhere a speaker renders inside a
// non-speaker surface (submission detail, session peek, …): headshot, a
// hover-carded name linking to the speaker spotlight, email, and a right-hand
// meta slot. Denser variations belong in the caller, not in a fork of this.
export function SpeakerRow({
  person,
  email,
  image,
  meta,
}: {
  readonly person: PersonPopoverData & { readonly id: string };
  readonly email: string;
  readonly image?: string | null;
  readonly meta?: ReactNode;
}) {
  const displayImage = image ?? person.image;
  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex items-center gap-3">
      {displayImage === null || displayImage === undefined ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
          {initials}
        </div>
      ) : (
        <img src={displayImage} alt="" className="size-10 shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <PersonHoverCard person={person}>
          <Link
            to="/admin/speakers"
            search={{ spotlight: person.id }}
            className="block w-fit max-w-full truncate text-sm font-medium hover:underline"
          >
            {person.name}
          </Link>
        </PersonHoverCard>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      {meta === undefined ? null : (
        <div className="shrink-0 text-right text-xs text-muted-foreground">{meta}</div>
      )}
    </div>
  );
}
