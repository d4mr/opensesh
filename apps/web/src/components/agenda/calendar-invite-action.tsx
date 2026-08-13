import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Button } from "@/components/ui/button";
import { invalidateAfterMutation } from "@/lib/after-mutation";
import { calendarInviteSummaryQuery } from "@/lib/mail-queries";
import { sendCalendarInvites } from "@/server-fns/mail";

export function CalendarInviteAction() {
  const eventContext = useAdminEvent();
  const queryClient = useQueryClient();
  const eventId = eventContext?.event.id ?? "";
  const options = calendarInviteSummaryQuery(eventId);
  const summary = useQuery({ ...options, enabled: eventId.length > 0 });
  const send = useMutation({
    mutationFn: () => sendCalendarInvites({ data: { eventId } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData(options.queryKey);
      queryClient.setQueryData(options.queryKey, (current) =>
        current?.ok
          ? ({ ok: true, data: { ...current.data, affectedSpeakers: 0 } } as const)
          : current,
      );
      return { previous };
    },
    onSuccess: async (result, _variables, context) => {
      if (!result.ok) {
        queryClient.setQueryData(options.queryKey, context.previous);
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `Queued ${result.data.queued} calendar ${result.data.queued === 1 ? "invite" : "invites"}`,
      );
      await invalidateAfterMutation(queryClient, eventId);
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(options.queryKey, context?.previous);
    },
  });

  if (eventContext === null) return null;
  const affected = summary.data?.ok === true ? summary.data.data.affectedSpeakers : 0;
  const scheduled = summary.data?.ok === true ? summary.data.data.scheduledSpeakers : 0;
  const checking = summary.isPending;

  return (
    <Button
      variant="outline"
      size="sm"
      className="pressable"
      disabled={checking || affected === 0 || send.isPending}
      title={checking ? undefined : `${affected} of ${scheduled} scheduled speakers need an invite`}
      onClick={() => send.mutate()}
    >
      <CalendarPlusIcon />
      {send.isPending ? "Sending invites…" : "Send invites"}
      {checking || affected === 0 ? null : (
        <span className="rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums">
          {affected}
        </span>
      )}
    </Button>
  );
}
