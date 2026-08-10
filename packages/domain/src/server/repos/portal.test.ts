import { describe, expect, it } from "vitest";

import { organizerContentChange, restoreOrganizerContent } from "./portal";

describe("organizer content history", () => {
  it("records changed values and restores the selected version without the later edit", () => {
    const original = { title: "Session", description: "Original abstract" };
    const first = { title: "UPDATED: Session", description: "Original abstract. Live demo." };
    const second = { ...first, description: `${first.description} Bring a laptop.` };

    const firstEntry = organizerContentChange(original, first);
    const secondEntry = organizerContentChange(first, second);

    expect(firstEntry).toEqual({
      changedFields: ["title", "description"],
      previousValues: original,
      newValues: first,
    });
    expect(secondEntry.changedFields).toEqual(["description"]);
    expect(restoreOrganizerContent(second, firstEntry.newValues)).toEqual(first);
  });
});
