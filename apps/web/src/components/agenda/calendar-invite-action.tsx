import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { useAdminEvent } from "@/components/app/admin-event-context";
import { Badge } from "@/components/ui/badge";
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
      if (result.data.failed > 0) {
        toast.error(
          `${result.data.failed} of ${result.data.attempted} calendar invites failed. Retry them in Email delivery.`,
        );
      } else {
        const label = result.data.demo > 0 ? "recorded in demo mode" : "sent";
        toast.success(
          `${result.data.attempted} calendar ${result.data.attempted === 1 ? "invite" : "invites"} ${label}`,
        );
      }
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
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="rounded-md tabular-nums">
        {checking ? "Checking schedule…" : `${affected} of ${scheduled} need invites`}
      </Badge>
      <Button
        size="sm"
        className="pressable"
        disabled={checking || affected === 0 || send.isPending}
        onClick={() => send.mutate()}
      >
        <CalendarPlusIcon />
        {send.isPending ? "Sending…" : "Send calendar invites"}
      </Button>
    </div>
  );
}
