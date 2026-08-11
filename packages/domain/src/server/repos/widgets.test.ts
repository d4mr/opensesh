import type { PublicProgram } from "../schema/widgets";
import { describe, expect, it } from "vitest";

import { findPublicSession, publicSubmissionVisible, speakerCsvUpdateValues } from "./widgets";

describe("speaker CSV updates", () => {
  it("preserves profile fields for omitted columns and blank cells alike", () => {
    const existing = {
      dietaryRequirements: "vegetarian" as const,
      tshirtSize: "M" as const,
    };
    const sparse = speakerCsvUpdateValues({
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@example.com",
      title: undefined,
      company: undefined,
      bio: undefined,
      dietary: undefined,
      tshirt: undefined,
      linkedin: undefined,
      twitter: undefined,
      facebook: undefined,
      website: undefined,
      phone: undefined,
      action: "update",
    });
    const clearing = speakerCsvUpdateValues({
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@example.com",
      title: undefined,
      company: undefined,
      bio: undefined,
      dietary: "",
      tshirt: null,
      linkedin: undefined,
      twitter: undefined,
      facebook: undefined,
      website: undefined,
      phone: undefined,
      action: "update",
    });

    expect({ ...existing, ...sparse }).toMatchObject({
      dietaryRequirements: "vegetarian",
      tshirtSize: "M",
    });
    // Enrichment policy (V2-005/026): a blank cell means "no information",
    // never "erase" — deliberate clearing belongs to the profile editors.
    expect({ ...existing, ...clearing }).toMatchObject({
      dietaryRequirements: "vegetarian",
      tshirtSize: "M",
    });
  });
});

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
