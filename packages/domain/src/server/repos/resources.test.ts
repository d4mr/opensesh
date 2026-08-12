import { describe, expect, it } from "vitest";

import { resourceAudienceVisible } from "./resources";

describe("resourceAudienceVisible", () => {
  const activeTracks = new Set(["track-a"]);

  it("shows all-audience resources", () => {
    expect(resourceAudienceVisible("all", new Set(), new Set(), activeTracks, "contact-a")).toBe(
      true,
    );
  });

  it("matches active session tracks only", () => {
    expect(
      resourceAudienceVisible("tracks", new Set(["track-a"]), new Set(), activeTracks, "contact-a"),
    ).toBe(true);
    expect(
      resourceAudienceVisible("tracks", new Set(["track-b"]), new Set(), activeTracks, "contact-a"),
    ).toBe(false);
  });

  it("matches explicit contacts only", () => {
    expect(
      resourceAudienceVisible(
        "contacts",
        new Set(),
        new Set(["contact-a"]),
        activeTracks,
        "contact-a",
      ),
    ).toBe(true);
    expect(
      resourceAudienceVisible(
        "contacts",
        new Set(),
        new Set(["contact-b"]),
        activeTracks,
        "contact-a",
      ),
    ).toBe(false);
  });
});
