import { describe, expect, it } from "vitest";

import { contactIsSpeaker } from "./shared";

describe("speaker predicate", () => {
  it("excludes submitter-only and rejected-only contacts", () => {
    expect(contactIsSpeaker("submitter", ["pending", "declined"])).toBe(false);
    expect(contactIsSpeaker("submitter", ["declined"])).toBe(false);
  });

  it("includes direct additions and accepted participants", () => {
    expect(contactIsSpeaker("speaker", [])).toBe(true);
    expect(contactIsSpeaker("submitter", ["declined", "accepted"])).toBe(true);
  });
});
