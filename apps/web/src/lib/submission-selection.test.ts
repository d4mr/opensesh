import { describe, expect, it } from "vitest";

import { selectedMatchingFilter, toggleFilteredSelection } from "./submission-selection";

const rows = [{ id: "accept-1" }, { id: "accept-2" }, { id: "decline-1" }];

describe("submission wave selection", () => {
  it("selects the entire filtered set rather than one display page", () => {
    const acrossPages = toggleFilteredSelection(new Set(), rows, true);
    expect([...acrossPages]).toEqual(["accept-1", "accept-2", "decline-1"]);
  });

  it("scopes actions to selected rows matching the active filter", () => {
    const selected = new Set(["accept-1", "decline-1"]);
    expect(selectedMatchingFilter(rows.slice(0, 2), selected).map((row) => row.id)).toEqual([
      "accept-1",
    ]);
    expect(selectedMatchingFilter([{ id: "decline-1" }], selected).map((row) => row.id)).toEqual([
      "decline-1",
    ]);
  });

  it("preserves hidden and cross-page ids while deselecting only the filtered set", () => {
    const selected = new Set(["accept-1", "accept-2", "decline-1"]);
    const next = toggleFilteredSelection(selected, rows.slice(0, 2), false);
    expect([...next]).toEqual(["decline-1"]);
  });
});
