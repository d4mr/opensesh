import { Widgets } from "@opensesh/domain/server/repos";
import { buildPersonalScheduleCalendar } from "@opensesh/domain/server/mail/ics";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { feedSessions } from "@/routes/embed.$embedId.json";
import { runServer } from "@/server/runtime";

// iCal feed of the widget's filtered sessions — subscribable from calendar
// apps, same visibility rules as every public surface.
export const Route = createFileRoute("/embed/$embedId/ics")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const result = await runServer(
          Effect.gen(function* () {
            const widgets = yield* Widgets;
            return yield* widgets.publicWidget(params.embedId);
          }),
        );
        if (!result.ok) return new Response(result.error.message, { status: result.error.status });
        const { widget, program } = result.data;
        if (!widget.enabled) return new Response("Embed disabled", { status: 404 });
        const origin = new URL(request.url).origin;
        const sessions = feedSessions(widget, program.sessions, program.event.timezone);
        const content = buildPersonalScheduleCalendar({
          name: `${program.event.name} — ${widget.name}`,
          timezone: program.event.timezone,
          events: sessions.map((session) => ({
            id: session.id,
            title: session.title,
            startsAt: new Date(session.startsAt),
            endsAt: new Date(session.endsAt),
            timezone: program.event.timezone,
            room: session.roomName,
            description: session.description.replace(/<[^>]*>/g, ""),
            portalUrl: `${origin}/e/${program.event.slug}/sessions/${session.code}`,
            sequence: 0,
          })),
        });
        return new Response(content, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${program.event.slug}-${widget.id}.ics"`,
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
