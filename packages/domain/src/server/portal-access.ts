// Portal access links: the speaker email IS the credential. Every
// contact-facing email carries /portal/access/<token>, which the web app
// exchanges for a session scoped to that contact's event — no second
// sign-in email. Tokens live in better-auth's verifications table under a
// namespaced identifier (only the SHA-256 hash is stored, mirroring the
// api-key material rules), so the auth plugin that verifies them reuses
// better-auth's own storage, expiry, and cleanup semantics.

const PORTAL_ACCESS_IDENTIFIER_PREFIX = "portal-access:";

// Long enough that a speaker can return to an acceptance email weeks later;
// bounded so a forwarded email does not grant access forever.
export const PORTAL_ACCESS_EXPIRY_DAYS = 60;

export interface PortalAccessGrant {
  readonly email: string;
  readonly name: string;
  readonly contactId: string;
  readonly eventId: string;
  readonly eventSlug: string;
}

const generatePortalAccessToken = () => {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashPortalAccessToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const portalAccessIdentifier = async (token: string) =>
  `${PORTAL_ACCESS_IDENTIFIER_PREFIX}${await hashPortalAccessToken(token)}`;

export const parsePortalAccessGrant = (value: string): PortalAccessGrant | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const grant = parsed as Record<string, unknown>;
    if (
      typeof grant.email !== "string" ||
      typeof grant.name !== "string" ||
      typeof grant.contactId !== "string" ||
      typeof grant.eventId !== "string" ||
      typeof grant.eventSlug !== "string"
    ) {
      return null;
    }
    return {
      email: grant.email,
      name: grant.name,
      contactId: grant.contactId,
      eventId: grant.eventId,
      eventSlug: grant.eventSlug,
    };
  } catch {
    return null;
  }
};

export interface PortalAccessMint {
  readonly origin: string;
  /** Portal-relative destination, e.g. "/portal/tasks". */
  readonly to: string;
  readonly grant: PortalAccessGrant;
  readonly now: Date;
}

export interface MintedPortalAccess {
  /** Insert value for the better-auth verifications table. */
  readonly verification: {
    readonly identifier: string;
    readonly value: string;
    readonly expiresAt: Date;
  };
  /** The tokened URL to embed in the email. */
  readonly url: string;
}

export const mintPortalAccess = async (input: PortalAccessMint): Promise<MintedPortalAccess> => {
  const token = generatePortalAccessToken();
  return {
    verification: {
      identifier: await portalAccessIdentifier(token),
      value: JSON.stringify(input.grant),
      expiresAt: new Date(input.now.getTime() + PORTAL_ACCESS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
    url: `${input.origin}/portal/access/${token}?to=${encodeURIComponent(input.to)}`,
  };
};
