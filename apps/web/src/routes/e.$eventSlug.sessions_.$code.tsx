import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import { SessionDetail } from "@/components/public/program-views";
import { publicProgramQuery, publicSessionQuery } from "@/lib/widget-queries";

export const Route = createFileRoute("/e/$eventSlug/sessions_/$code")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicSessionQuery(params.eventSlug, params.code)),
  component: Detail,
});
function Detail() {
  const { eventSlug, code } = Route.useParams();
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  const detail = useSuspenseQuery(publicSessionQuery(eventSlug, code));
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  if (!detail.data.ok)
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-semibold tracking-tight">Session not found</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This session is not part of the published agenda.
        </p>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-7">
      <Link
        to="/e/$eventSlug/sessions"
        params={{ eventSlug }}
        search={{ q: undefined, track: undefined, format: undefined, room: undefined }}
        className="pressable mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-3.5" /> All sessions
      </Link>
      <SessionDetail program={program.data.data} session={detail.data.data} />
    </main>
  );
}
