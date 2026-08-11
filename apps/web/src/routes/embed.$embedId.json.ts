import {
  filterPublicSessions,
  plainTextFromRichText,
  type PublicSession,
  type Widget,
} from "@opensesh/domain";
import { Widgets } from "@opensesh/domain/server/repos";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";

import { runServer } from "@/server/runtime";

// Machine-readable feed for the saved widget: same live data and filters as
// the iframe, so integrators can build their own markup against a stable URL.
export const feedSessions = (widget: Widget, sessions: ReadonlyArray<PublicSession>, tz: string) =>
  filterPublicSessions(sessions, {
    timezone: tz,
    trackIds: widget.options.trackIds,
    formatIds: widget.options.formatIds,
    tagIds: widget.options.tagIds,
    dayKeys: widget.options.dayKeys,
  });

export const Route = createFileRoute("/embed/$embedId/json")({
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
        const payload = {
          widget: { id: widget.id, name: widget.name, view: widget.view },
          event: {
            name: program.event.name,
            slug: program.event.slug,
            timezone: program.event.timezone,
            startsAt: program.event.startsAt,
            endsAt: program.event.endsAt,
            url: `${origin}/e/${program.event.slug}`,
          },
          sessions: sessions.map((session) => ({
            id: session.id,
            code: session.code,
            title: session.title,
            description: plainTextFromRichText(session.description),
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            room: session.roomName,
            format: session.format?.name ?? null,
            level: session.level?.name ?? null,
            tracks: session.tracks.map((track) => track.name),
            tags: session.tags.map((tag) => tag.name),
            url: `${origin}/e/${program.event.slug}/sessions/${session.code}`,
            speakers: session.speakers.map((speaker) => ({
              name: `${speaker.firstName} ${speaker.lastName}`,
              title: speaker.title,
              company: speaker.company,
            })),
          })),
        };
        return new Response(JSON.stringify(payload, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=60",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
