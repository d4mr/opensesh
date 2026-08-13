import { describe, expect, it } from "vitest";

import { MailError } from "./errors";
import { mailFailureStatus, planMailSweep } from "./mail";

describe("mail delivery classification", () => {
  it("requeues network and rate-limit failures but permanently fails rejections", () => {
    expect(
      mailFailureStatus(
        new MailError({ message: "network", cause: new TypeError("offline"), transient: true }),
      ),
    ).toBe("queued");
    expect(
      mailFailureStatus(
        new MailError({ message: "rejected", cause: { status: 400 }, transient: false }),
      ),
    ).toBe("failed");
  });
});

describe("mail sweeper", () => {
  it("re-enqueues stale queued rows and resets stale sending rows", () => {
    const before = new Date("2027-04-01T00:05:00.000Z");
    const plan = planMailSweep(
      [
        { id: "lost-enqueue", status: "queued", updatedAt: new Date("2027-04-01T00:00:00Z") },
        { id: "crashed-consumer", status: "sending", updatedAt: new Date("2027-04-01T00:00:00Z") },
        { id: "fresh", status: "queued", updatedAt: new Date("2027-04-01T00:05:00Z") },
      ],
      before,
    );
    expect(plan.resetIds).toEqual(["crashed-consumer"]);
    expect(plan.enqueueIds).toEqual(["lost-enqueue", "crashed-consumer"]);
  });
});
