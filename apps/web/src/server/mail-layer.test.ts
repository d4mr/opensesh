import { describe, expect, it } from "vitest";

import { mailTransportFailureIsTransient } from "./mail-layer";

describe("mail transport failure classification", () => {
  it("retries network, rate-limit, and server failures", () => {
    expect(mailTransportFailureIsTransient(new TypeError("network unavailable"))).toBe(true);
    expect(mailTransportFailureIsTransient({ status: 429 })).toBe(true);
    expect(mailTransportFailureIsTransient({ status: 503 })).toBe(true);
  });

  it("does not retry permanent provider rejections", () => {
    expect(mailTransportFailureIsTransient({ status: 400 })).toBe(false);
    expect(mailTransportFailureIsTransient(new Error("recipient rejected"))).toBe(false);
  });
});
