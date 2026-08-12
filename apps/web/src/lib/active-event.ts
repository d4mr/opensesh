/**
 * The selected admin event, persisted in a cookie so BOTH sides of the app
 * agree on it: route loaders (which prefetch on the server during SSR and on
 * the client during navigation) and the admin layout (which renders the
 * picker). Before this lived in localStorage, which the server cannot read —
 * so every loader guessed "first event in the org" and prefetched the wrong
 * event's data whenever another one was selected.
 */

export const ACTIVE_EVENT_COOKIE = "opensesh-event-id";

export const activeEventIdFromCookieHeader = (header: string | null): string | null => {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== ACTIVE_EVENT_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
};

export const storeActiveEventId = (eventId: string): void => {
  document.cookie = `${ACTIVE_EVENT_COOKIE}=${encodeURIComponent(eventId)}; path=/; max-age=31536000; samesite=lax`;
};

/** The event the admin UI shows: the stored selection when it still exists, else the first event. */
export const resolveActiveEvent = <E extends { readonly id: string }>(
  events: ReadonlyArray<E>,
  storedEventId: string | null,
): E | undefined => events.find((item) => item.id === storedEventId) ?? events[0];
