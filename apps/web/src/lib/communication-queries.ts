import { queryOptions } from "@tanstack/react-query";

import { getCommunicationCenter } from "@/server-fns/speaker-comms";

export const communicationCenterQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["speaker-communications", eventId],
    queryFn: () => getCommunicationCenter({ data: { eventId } }),
    staleTime: 10_000,
  });
