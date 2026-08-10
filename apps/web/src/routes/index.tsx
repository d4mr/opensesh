import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEvent } from "@/server-fns/get-event";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const event = useQuery({
    queryKey: ["event", "ai-engineer-nyc-2026"],
    queryFn: () => getEvent(),
  });

  if (event.data === undefined) {
    return null;
  }

  if (!event.data.ok) {
    return <p className="mx-auto mt-16 max-w-xl px-6">{event.data.error.message}</p>;
  }

  const { data } = event.data;
  const eventDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: data.timezone,
  });

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">{data.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            {eventDate.format(new Date(data.startsAt))} – {eventDate.format(new Date(data.endsAt))}
          </p>
          <p className="mt-1">{data.timezone}</p>
        </CardContent>
      </Card>
    </main>
  );
}
