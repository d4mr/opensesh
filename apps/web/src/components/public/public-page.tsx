import type { WidgetView } from "@opensesh/domain";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PrinterIcon } from "lucide-react";

import { ProgramView, type SessionListState } from "@/components/public/program-views";
import { Button } from "@/components/ui/button";
import { publicProgramQuery } from "@/lib/widget-queries";

const copy: Readonly<Record<WidgetView, { title: string; subtitle: string }>> = {
  sessions: { title: "Sessions", subtitle: "Explore the published program by topic and format." },
  speakers: { title: "Speakers", subtitle: "Meet the people sharing their work and lessons." },
  speaker_gallery: {
    title: "Speaker gallery",
    subtitle: "Meet the people sharing their work and lessons.",
  },
  agenda: { title: "Agenda", subtitle: "Plan your days across every room and track." },
  itinerary: {
    title: "Schedule itinerary",
    subtitle: "A chronological, print-friendly view of the program.",
  },
};

export function PublicPage({
  eventSlug,
  view,
  sessionState,
  onSessionStateChange,
  speakerSearch,
  onSpeakerSearchChange,
}: {
  readonly eventSlug: string;
  readonly view: WidgetView;
  readonly sessionState?: SessionListState;
  readonly onSessionStateChange?: (state: SessionListState) => void;
  readonly speakerSearch?: string;
  readonly onSpeakerSearchChange?: (value: string) => void;
}) {
  const program = useSuspenseQuery(publicProgramQuery(eventSlug));
  if (!program.data.ok) return <p className="p-6 text-sm">{program.data.error.message}</p>;
  return (
    <main className="mx-auto max-w-5xl px-4 py-7 print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex items-start justify-between gap-3 print:mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{copy[view].title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy[view].subtitle}</p>
        </div>
        {view === "speakers" ? (
          <a
            href={`/e/${eventSlug}/speakers/gallery`}
            className="pressable rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            Gallery view
          </a>
        ) : null}
        {view === "speaker_gallery" ? (
          <a
            href={`/e/${eventSlug}/speakers`}
            className="pressable rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            List view
          </a>
        ) : null}
        {view === "itinerary" ? (
          <Button
            size="sm"
            variant="outline"
            className="pressable print:hidden"
            onClick={() => window.print()}
          >
            <PrinterIcon /> Print
          </Button>
        ) : null}
      </div>
      <ProgramView
        view={view}
        program={program.data.data}
        sessionControls={view === "sessions"}
        sessionState={sessionState}
        onSessionStateChange={onSessionStateChange}
        speakerSearch={speakerSearch}
        onSpeakerSearchChange={onSpeakerSearchChange}
      />
    </main>
  );
}
