import type { PublicProgram } from "../schema/widgets";
import { describe, expect, it } from "vitest";

import { findPublicSession, publicSubmissionVisible } from "./widgets";

const program: PublicProgram = {
  event: {
    id: "event",
    slug: "devflow",
    name: "DevFlow",
    tagline: null,
    description: null,
    logoUrl: null,
    location: null,
    timezone: "America/Los_Angeles",
    startsAt: "2027-05-12T16:00:00.000Z",
    endsAt: "2027-05-15T00:00:00.000Z",
    agendaPublishedAt: "2027-04-01T00:00:00.000Z",
  },
  tracks: [],
  formats: [],
  tags: [],
  sessions: [],
};

describe("public content approval", () => {
  it("excludes accepted sessions whose content is not approved", () => {
    expect(
      publicSubmissionVisible({ status: "accepted", contentReviewStatus: "pending_review" }),
    ).toBe(false);
    expect(publicSubmissionVisible({ status: "accepted", contentReviewStatus: "rejected" })).toBe(
      false,
    );
    expect(publicSubmissionVisible({ status: "accepted", contentReviewStatus: "approved" })).toBe(
      true,
    );
  });

  it("returns NotFound for a direct lookup excluded from the public program", () => {
    const result = findPublicSession(program, "SESS-PRIVATE");
    expect(result).toMatchObject({ _tag: "NotFound" });
  });
});
