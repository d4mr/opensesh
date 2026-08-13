/**
 * The event a speaker's portal session is pinned to, mirroring the admin
 * side's active-event cookie. A contact whose email appears in several
 * events would otherwise land on an arbitrary one — the portal access
 * endpoint and the branded event sign-in page both set this so the portal
 * resolves the event the speaker actually arrived for.
 */

export const PORTAL_EVENT_COOKIE = "opensesh-portal-event";

export const portalEventSlugFromCookieHeader = (header: string | null): string | null => {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== PORTAL_EVENT_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
};

export const storePortalEventSlug = (eventSlug: string): void => {
  document.cookie = `${PORTAL_EVENT_COOKIE}=${encodeURIComponent(eventSlug)}; path=/; max-age=31536000; samesite=lax`;
};
