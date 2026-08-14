/**
 * Which contact an admin is impersonating in the portal preview, persisted
 * as a cookie for the same reason as the active-event selection: the server
 * (SSR loaders, getSpeakerPortal) and the client must agree on it across
 * every portal navigation without threading a param through each link. Only
 * honored for users with staff access to the event — a speaker's own portal
 * never reads it.
 */

export const PORTAL_PREVIEW_CONTACT_COOKIE = "opensesh-portal-preview-contact";

export const previewContactIdFromCookieHeader = (header: string | null): string | null => {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== PORTAL_PREVIEW_CONTACT_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
};

export const storePreviewContactId = (contactId: string): void => {
  document.cookie = `${PORTAL_PREVIEW_CONTACT_COOKIE}=${encodeURIComponent(contactId)}; path=/; max-age=31536000; samesite=lax`;
};
