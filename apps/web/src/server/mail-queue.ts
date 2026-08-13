import { Context, Effect, Layer } from "effect";

export interface MailQueueMessage {
  readonly logId: string;
}

export interface MailQueueEnqueueResult {
  readonly enqueued: number;
  readonly failed: number;
}

export const mailQueueChunks = (
  logIds: ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<string>> => {
  const chunks: Array<ReadonlyArray<string>> = [];
  for (let index = 0; index < logIds.length; index += 100) {
    chunks.push(logIds.slice(index, index + 100));
  }
  return chunks;
};

export const enqueueMailLogIds = async (
  queue: Queue,
  logIds: ReadonlyArray<string>,
): Promise<MailQueueEnqueueResult> => {
  let enqueued = 0;
  let failed = 0;
  for (const chunk of mailQueueChunks(logIds)) {
    try {
      await queue.sendBatch(chunk.map((logId) => ({ body: { logId }, contentType: "json" })));
      enqueued += chunk.length;
    } catch (cause) {
      failed += chunk.length;
      console.error(
        JSON.stringify({
          event: "mail_enqueue_failed",
          count: chunk.length,
          error: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
  return { enqueued, failed };
};

interface MailQueueService {
  readonly enqueue: (logIds: ReadonlyArray<string>) => Effect.Effect<MailQueueEnqueueResult>;
}

export class MailQueue extends Context.Service<MailQueue, MailQueueService>()(
  "opensesh/MailQueue",
) {}

export const makeMailQueueLive = (queue: Queue) =>
  Layer.succeed(MailQueue, {
    enqueue: (logIds) => Effect.promise(() => enqueueMailLogIds(queue, logIds)),
  });

export const retryDelaySeconds = (attempts: number) =>
  Math.min(30 * 2 ** Math.max(0, attempts - 1), 3600);

export type MailQueueDeliveryOutcome =
  | { readonly kind: "delivered" }
  | { readonly kind: "skipped" }
  | { readonly kind: "permanent" }
  | { readonly kind: "transient" };

export const consumeMailBatch = async (
  batch: MessageBatch<MailQueueMessage>,
  deliver: (message: MailQueueMessage, attempts: number) => Promise<MailQueueDeliveryOutcome>,
): Promise<void> => {
  for (const message of batch.messages) {
    try {
      const outcome = await deliver(message.body, message.attempts);
      if (outcome.kind === "transient" && message.attempts <= 5) {
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      } else {
        message.ack();
      }
    } catch (cause) {
      console.error(
        JSON.stringify({
          event: "mail_consumer_failed",
          logId: message.body.logId,
          attempts: message.attempts,
          error: cause instanceof Error ? cause.message : String(cause),
        }),
      );
      if (message.attempts <= 5) {
        message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      } else {
        message.ack();
      }
    }
  }
};
