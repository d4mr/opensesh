import { describe, expect, it, vi } from "vitest";

import {
  consumeMailBatch,
  enqueueMailLogIds,
  mailQueueChunks,
  type MailQueueMessage,
} from "./mail-queue";

const queueMessage = (attempts = 1) => {
  const ack = vi.fn();
  const retry = vi.fn();
  return {
    message: {
      id: "message-1",
      timestamp: new Date(),
      body: { logId: "log-1" },
      attempts,
      ack,
      retry,
    } satisfies Message<MailQueueMessage>,
    ack,
    retry,
  };
};

const batch = (message: Message<MailQueueMessage>): MessageBatch<MailQueueMessage> => ({
  queue: "opensesh-mail",
  messages: [message],
  metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
  ackAll: vi.fn(),
  retryAll: vi.fn(),
});

describe("mail queue producer", () => {
  it("chunks sendBatch calls at 100 messages", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `log-${index}`);
    expect(mailQueueChunks(ids).map((chunk) => chunk.length)).toEqual([100, 100, 5]);
    const sendBatch = vi.fn().mockResolvedValue({});
    const queue: Queue = {
      metrics: vi.fn().mockResolvedValue({ backlogCount: 0, backlogBytes: 0 }),
      send: vi.fn().mockResolvedValue({
        metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
      }),
      sendBatch,
    };
    const result = await enqueueMailLogIds(queue, ids);
    expect(sendBatch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ enqueued: 205, failed: 0 });
  });

  it("leaves failed chunks recoverable while continuing later chunks", async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `log-${index}`);
    const sendBatch = vi
      .fn()
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValue({});
    const queue: Queue = {
      metrics: vi.fn().mockResolvedValue({ backlogCount: 0, backlogBytes: 0 }),
      send: vi.fn().mockResolvedValue({
        metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
      }),
      sendBatch,
    };
    await expect(enqueueMailLogIds(queue, ids)).resolves.toEqual({ enqueued: 101, failed: 100 });
    expect(sendBatch).toHaveBeenCalledTimes(3);
  });
});

describe("mail queue consumer", () => {
  it("acks delivered and already-claimed messages without a second send", async () => {
    const first = queueMessage();
    const redelivery = queueMessage(2);
    const deliver = vi
      .fn()
      .mockResolvedValueOnce({ kind: "delivered" })
      .mockResolvedValueOnce({ kind: "skipped" });
    await consumeMailBatch(batch(first.message), deliver);
    await consumeMailBatch(batch(redelivery.message), deliver);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(redelivery.retry).not.toHaveBeenCalled();
  });

  it("is at-least-once safe because only the queued row wins the atomic claim", async () => {
    let status: "queued" | "sent" = "queued";
    let sends = 0;
    const deliver = vi.fn(async () => {
      if (status !== "queued") return { kind: "skipped" } as const;
      status = "sent";
      sends += 1;
      return { kind: "delivered" } as const;
    });
    const first = queueMessage();
    const duplicate = queueMessage(2);
    await consumeMailBatch(batch(first.message), deliver);
    await consumeMailBatch(batch(duplicate.message), deliver);
    expect(sends).toBe(1);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(duplicate.ack).toHaveBeenCalledOnce();
  });

  it("retries transient outcomes and acks permanent outcomes", async () => {
    const transient = queueMessage(2);
    const permanent = queueMessage(1);
    await consumeMailBatch(batch(transient.message), async () => ({ kind: "transient" }));
    await consumeMailBatch(batch(permanent.message), async () => ({ kind: "permanent" }));
    expect(transient.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(transient.ack).not.toHaveBeenCalled();
    expect(permanent.ack).toHaveBeenCalledOnce();
    expect(permanent.retry).not.toHaveBeenCalled();
  });

  it("acks an exhausted transient outcome for the email-log dead-letter ledger", async () => {
    const exhausted = queueMessage(6);
    await consumeMailBatch(batch(exhausted.message), async () => ({ kind: "transient" }));
    expect(exhausted.ack).toHaveBeenCalledOnce();
    expect(exhausted.retry).not.toHaveBeenCalled();
  });

  it("does not ask the platform to retry an exhausted unexpected failure", async () => {
    const exhausted = queueMessage(6);
    await consumeMailBatch(batch(exhausted.message), async () => {
      throw new Error("consumer defect");
    });
    expect(exhausted.ack).toHaveBeenCalledOnce();
    expect(exhausted.retry).not.toHaveBeenCalled();
  });
});
