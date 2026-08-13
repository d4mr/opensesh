import { describe, expect, it } from "vitest";

import {
  mintPortalAccess,
  parsePortalAccessGrant,
  PORTAL_ACCESS_EXPIRY_DAYS,
  portalAccessIdentifier,
} from "./portal-access";

const grant = {
  email: "priya@example.com",
  name: "Priya Raman",
  contactId: "con_priya",
  eventId: "evt_devflow",
  eventSlug: "devflow-2027",
};

describe("portal access tokens", () => {
  it("mints a tokened URL whose stored identifier is the hash, never the token", async () => {
    const now = new Date("2027-04-10T12:00:00.000Z");
    const minted = await mintPortalAccess({
      origin: "https://app.opensesh.io",
      to: "/portal/tasks",
      grant,
      now,
    });
    const url = new URL(minted.url);
    const token = url.pathname.split("/").at(-1) ?? "";
    expect(url.pathname.startsWith("/portal/access/")).toBe(true);
    expect(token).toMatch(/^[0-9a-f]{40}$/);
    expect(url.searchParams.get("to")).toBe("/portal/tasks");
    // The raw token must not be recoverable from the stored row.
    expect(minted.verification.identifier).not.toContain(token);
    expect(minted.verification.identifier).toBe(await portalAccessIdentifier(token));
    expect(minted.verification.expiresAt).toEqual(
      new Date(now.getTime() + PORTAL_ACCESS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    );
  });

  it("round-trips the grant through the stored value and rejects junk", async () => {
    const minted = await mintPortalAccess({
      origin: "https://app.opensesh.io",
      to: "/portal",
      grant,
      now: new Date(),
    });
    expect(parsePortalAccessGrant(minted.verification.value)).toEqual(grant);
    expect(parsePortalAccessGrant("not json")).toBeNull();
    expect(parsePortalAccessGrant(JSON.stringify({ email: "x" }))).toBeNull();
  });

  it("mints unique tokens per call", async () => {
    const now = new Date();
    const input = { origin: "https://app.opensesh.io", to: "/portal", grant, now };
    const [first, second] = await Promise.all([mintPortalAccess(input), mintPortalAccess(input)]);
    expect(first.url).not.toBe(second.url);
    expect(first.verification.identifier).not.toBe(second.verification.identifier);
  });
});
