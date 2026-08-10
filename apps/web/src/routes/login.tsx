import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { LoginForm } from "@/components/login-form";
import { getPublicEvent } from "@/server-fns/auth";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const event = useQuery({
    queryKey: ["event", "ai-engineer-nyc-2026"],
    queryFn: () => getPublicEvent(),
  });
  const eventData = event.data?.ok ? event.data.data : undefined;
  const eventName = eventData?.name ?? "AI.Engineer Sandbox — NYC 2026";
  const eventDates =
    eventData === undefined
      ? "October 12–14, 2026"
      : formatDates(eventData.startsAt, eventData.endsAt);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm eventName={eventName} eventDates={eventDates} />
      </div>
    </main>
  );
}

function formatDates(startsAt: Date, endsAt: Date) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" });
  return `${month.format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
}
