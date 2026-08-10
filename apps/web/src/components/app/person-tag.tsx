import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const initials = (name: string) =>
  name
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function PersonTag({
  person,
}: {
  readonly person: { readonly name: string; readonly image: string | null } | null;
}) {
  if (person === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        <span className="size-4 rounded-full bg-muted-foreground/15" aria-hidden="true" />
        Unassigned
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
      <Avatar className="size-4">
        {person.image === null ? null : <AvatarImage src={person.image} alt="" />}
        <AvatarFallback className="text-[8px]">{initials(person.name)}</AvatarFallback>
      </Avatar>
      {person.name}
    </span>
  );
}
