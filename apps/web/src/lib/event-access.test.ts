import type { CurrentUserValue } from "@opensesh/domain/server/current-user";
import { describe, expect, it } from "vitest";

import { eventAccessFor } from "./event-access";

const user = {
  userId: "user-1",
  email: "reviewer@example.com",
  name: "Reviewer",
  orgId: "org-1",
  organizationName: "Organization",
  organizationLogo: null,
  eventSlug: "admin-event",
  orgRole: "member",
  events: [
    { id: "event-admin", slug: "admin-event", memberRole: "admin" },
    { id: "event-review", slug: "review-event", memberRole: "reviewer" },
  ],
  roles: { admin: true, reviewer: false, member: true },
} satisfies CurrentUserValue;

describe("eventAccessFor", () => {
  it("uses the selected event role instead of the preferred-event role", () => {
    expect(eventAccessFor(user, "event-review")).toEqual({
      admin: false,
      reviewer: true,
    });
  });

  it("retains organizer access on the selected admin event", () => {
    expect(eventAccessFor(user, "event-admin")).toEqual({
      admin: true,
      reviewer: false,
    });
  });
});
