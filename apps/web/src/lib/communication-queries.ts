import { queryOptions } from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { getCommunicationCenter } from "@/server-fns/speaker-comms";

export const communicationCenterQuery = (eventId: string) =>
  queryOptions({
    queryKey: qk.communications(eventId),
    queryFn: () => getCommunicationCenter({ data: { eventId } }),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const result = query.state.data;
      return result?.ok && result.data.pending.queued + result.data.pending.sending > 0
        ? 1_000
        : false;
    },
  });
