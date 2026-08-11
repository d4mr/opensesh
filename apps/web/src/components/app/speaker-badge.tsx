import { Link } from "@tanstack/react-router";

import { PersonHoverCard, type PersonPopoverData } from "@/components/app/person-popover";
import { PersonTag } from "@/components/app/person-tag";

// THE speaker badge: the content-table style person tag (headshot + name)
// with the profile hover card attached. Any surface that renders a speaker
// as a chip uses this — never a bare PersonTag next to a hand-rolled
// HoverCard wrapper. `linkToSpotlight` makes the whole chip a link to the
// speaker's directory spotlight (requires person.id).
export function SpeakerBadge({
  person,
  side,
  linkToSpotlight = false,
}: {
  readonly person: PersonPopoverData;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly linkToSpotlight?: boolean;
}) {
  const tag = <PersonTag person={{ name: person.name, image: person.image }} />;
  return (
    <PersonHoverCard person={person} side={side}>
      {linkToSpotlight && person.id !== undefined ? (
        <Link
          to="/admin/speakers"
          search={{ spotlight: person.id }}
          className="pressable rounded-md"
        >
          {tag}
        </Link>
      ) : (
        tag
      )}
    </PersonHoverCard>
  );
}
