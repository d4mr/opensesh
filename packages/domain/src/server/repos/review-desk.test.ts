import { describe, expect, it } from "vitest";

import {
  decisionConfirmationRequired,
  decisionEmailLogValue,
  decisionFactUpdate,
  informFactUpdate,
  informValidationError,
  informedAcceptanceRevoked,
} from "./review-desk";

describe("re-decision confirmation", () => {
  it("allows a free replacement before inform", () => {
    expect(decisionConfirmationRequired("accepted", null, "declined")).toBe(false);
    expect(decisionConfirmationRequired("declined", null, "accepted")).toBe(false);
  });

  it("gates a replacement after inform", () => {
    const informed = new Date("2027-04-01T00:00:00.000Z");
    expect(decisionConfirmationRequired("accepted", informed, "declined")).toBe(true);
    expect(decisionConfirmationRequired("declined", informed, "accepted")).toBe(true);
    expect(decisionConfirmationRequired("accepted", informed, "accepted")).toBe(false);
  });
});

describe("informed acceptance revocation", () => {
  const informed = new Date("2027-04-01T00:00:00.000Z");

  it("blocks declining an acceptance the submitter was told about", () => {
    expect(informedAcceptanceRevoked("accepted", informed, "declined")).toBe(true);
  });

  it("keeps the private phase and waitlist promotion legal", () => {
    // Un-informed acceptance may still be freely replaced.
    expect(informedAcceptanceRevoked("accepted", null, "declined")).toBe(false);
    // An informed decline may be promoted to accepted (new acceptance email).
    expect(informedAcceptanceRevoked("declined", informed, "accepted")).toBe(false);
    // Re-affirming the same decision is never a revocation.
    expect(informedAcceptanceRevoked("accepted", informed, "accepted")).toBe(false);
  });
});

describe("decide and inform split", () => {
  it("keeps the decision mutation free of notification and email facts", () => {
    const update = decisionFactUpdate("accepted", new Date("2027-04-01T00:00:00.000Z"));
    expect(update).toEqual({
      status: "accepted",
      updatedAt: new Date("2027-04-01T00:00:00.000Z"),
    });
    expect(update).not.toHaveProperty("notifiedAt");
    expect(update).not.toHaveProperty("email");
  });

  it("accepts only uninformed final decisions with a submitter", () => {
    const valid = {
      status: "accepted" as const,
      notifiedAt: null,
      submitterContactId: "contact-1",
      email: "submitter@example.com",
      firstName: "Submitter",
    };
    expect(informValidationError([valid])).toBeNull();
    expect(informValidationError([{ ...valid, status: "pending" }])).toContain("accepted");
    expect(informValidationError([{ ...valid, notifiedAt: new Date() }])).toContain("already");
    expect(informValidationError([{ ...valid, submitterContactId: null }])).toContain("submitter");
  });

  it("stamps the inform fact and queues exactly the submitter delivery", () => {
    const now = new Date("2027-04-01T00:00:00.000Z");
    expect(informFactUpdate(now)).toEqual({ notifiedAt: now, updatedAt: now });
    const email = decisionEmailLogValue({
      eventId: "event-1",
      submissionId: "submission-1",
      submitterContactId: "submitter-1",
      decision: "declined",
      recipient: "submitter@example.com",
      subject: "Decision",
      text: "Text",
      html: "<p>Text</p>",
    });
    expect(email).toMatchObject({
      contactId: "submitter-1",
      recipient: "submitter@example.com",
      status: "queued",
    });
    expect(email).not.toHaveProperty("participantContactIds");
    expect(email).not.toHaveProperty("delivery");
  });
});
