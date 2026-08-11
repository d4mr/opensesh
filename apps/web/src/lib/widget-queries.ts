import { queryOptions } from "@tanstack/react-query";

import {
  getPublicProgram,
  getPublicSession,
  getPublicWidget,
  getSpeakerDirectory,
  listWidgets,
} from "@/server-fns/widgets";

export const publicProgramQuery = (eventSlug: string) =>
  queryOptions({
    queryKey: ["public-program", eventSlug],
    queryFn: () => getPublicProgram({ data: { eventSlug } }),
    staleTime: 10_000,
  });
export const publicSessionQuery = (eventSlug: string, code: string) =>
  queryOptions({
    queryKey: ["public-session", eventSlug, code],
    queryFn: () => getPublicSession({ data: { eventSlug, code } }),
    staleTime: 10_000,
  });
// postMessage channel between the widget builder and its preview iframe. The
// builder pushes the live draft into the embed so the preview updates without
// reloading the frame or waiting for autosave; the embed announces readiness
// so the first paint syncs even if it finishes loading after the builder's
// initial post.
export const WIDGET_PREVIEW_MESSAGE = "opensesh-widget-preview";
export const WIDGET_PREVIEW_READY_MESSAGE = "opensesh-widget-preview-ready";

export const publicWidgetQuery = (embedId: string) =>
  queryOptions({
    queryKey: ["public-widget", embedId],
    queryFn: () => getPublicWidget({ data: { embedId } }),
    staleTime: 0,
  });
export const widgetsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["widgets", eventId],
    queryFn: () => listWidgets({ data: { eventId } }),
    staleTime: 0,
  });
export const speakerDirectoryQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["speaker-directory", eventId],
    queryFn: () => getSpeakerDirectory({ data: { eventId } }),
    staleTime: 0,
  });
