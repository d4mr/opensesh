import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { qk } from "@/lib/query-keys";
import { storePreviewContactId } from "@/lib/portal-preview";
import { searchEventContacts } from "@/server-fns/portal";

// The preview banner's impersonation surface: the shown name opens a
// search over every contact of the event — speakers and submitters alike —
// and one click re-renders the portal as that person sees it.
export function PortalPreviewPicker({
  eventId,
  current,
}: {
  readonly eventId: string;
  readonly current: { readonly contactId: string; readonly contactName: string };
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const contacts = useQuery({
    queryKey: qk.portalPreviewContacts(eventId),
    queryFn: () => searchEventContacts({ data: { eventId, query: "" } }),
    enabled: open,
    staleTime: 30_000,
  });
  const rows = contacts.data?.ok === true ? contacts.data.data : [];

  const choose = (contactId: string) => {
    setOpen(false);
    if (contactId === current.contactId) return;
    storePreviewContactId(contactId);
    // The impersonated contact feeds every portal query; refetch the lot.
    void queryClient.invalidateQueries();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable inline-flex items-center gap-0.5 font-medium text-foreground"
      >
        {current.contactName}
        <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Preview portal as"
        description="Search this event's speakers and submitters"
        showCloseButton={false}
      >
        <CommandInput placeholder="Preview the portal as…" />
        <CommandList>
          <CommandEmpty>
            {contacts.isPending ? "Loading contacts…" : "No contacts match."}
          </CommandEmpty>
          {rows.map((contact) => (
            <CommandItem
              key={contact.id}
              value={`${contact.firstName} ${contact.lastName} ${contact.email}`}
              onSelect={() => choose(contact.id)}
            >
              <span className="min-w-0 flex-1 truncate">
                {contact.firstName} {contact.lastName}
                <span className="ml-2 text-muted-foreground">{contact.email}</span>
              </span>
              <Badge variant="outline" className="rounded-md text-muted-foreground">
                {contact.speaker ? "Speaker" : "Submitter"}
              </Badge>
              {contact.id === current.contactId ? <CheckIcon className="size-3.5" /> : null}
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
