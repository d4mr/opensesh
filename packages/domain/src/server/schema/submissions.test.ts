import { describe, expect, it } from "vitest";

import {
  deriveSpeakerPipeline,
  portalAcceptanceArtifactsVisible,
  portalStatus,
} from "./submissions";

describe("portal decision projection", () => {
  it("keeps maybe and uninformed final decisions in review", () => {
    expect(portalStatus({ status: "maybe", notifiedAt: null })).toBe("pending");
    expect(portalStatus({ status: "accepted", notifiedAt: null })).toBe("pending");
    expect(portalStatus({ status: "declined", notifiedAt: null })).toBe("pending");
  });

  it("reveals final decisions only after inform", () => {
    const informed = new Date("2027-04-01T00:00:00.000Z");
    expect(portalStatus({ status: "accepted", notifiedAt: informed })).toBe("accepted");
    expect(portalStatus({ status: "declined", notifiedAt: informed })).toBe("declined");
  });

  it("hides acceptance artifacts until the decision is informed", () => {
    expect(portalAcceptanceArtifactsVisible({ status: "accepted", notifiedAt: null })).toBe(false);
    expect(portalAcceptanceArtifactsVisible({ status: "accepted", notifiedAt: new Date() })).toBe(
      true,
    );
    expect(portalAcceptanceArtifactsVisible({ status: "maybe", notifiedAt: null })).toBe(false);
  });
});

describe("derived speaker pipeline", () => {
  const base = {
    isSpeaker: true,
    acceptedSessions: [{ cancelledBy: null }],
    confirmedAt: null,
    outstandingTasks: 0,
    outstandingFiles: 0,
    profileReady: true,
    portalInvitationSent: false,
    decisionInformed: false,
  } as const;

  it("prioritizes speaker withdrawal", () => {
    expect(
      deriveSpeakerPipeline({
        ...base,
        acceptedSessions: [{ cancelledBy: "speaker" }, { cancelledBy: "speaker" }],
        confirmedAt: new Date(),
      }),
    ).toBe("withdrawn");
  });

  it("distinguishes ready, onboarding, invited, and added", () => {
    expect(deriveSpeakerPipeline({ ...base, confirmedAt: new Date() })).toBe("ready");
    expect(deriveSpeakerPipeline({ ...base, confirmedAt: new Date(), outstandingTasks: 1 })).toBe(
      "onboarding",
    );
    expect(deriveSpeakerPipeline({ ...base, portalInvitationSent: true })).toBe("invited");
    expect(deriveSpeakerPipeline(base)).toBe("added");
    expect(deriveSpeakerPipeline({ ...base, isSpeaker: false })).toBeNull();
  });
});
