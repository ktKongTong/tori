import type { EventDispatcher } from "./eventing.ts";

export type CloudflareQueueContentType = "text" | "bytes" | "json" | "v8";

export type CloudflareQueueMessage<TEvent> = {
  body: TEvent;
  contentType: CloudflareQueueContentType;
};

export type CloudflareQueueBinding<TEvent = unknown> = {
  send(message: TEvent, options?: unknown): Promise<void>;
  sendBatch(messages: CloudflareQueueMessage<TEvent>[], options?: unknown): Promise<void>;
};

export class CloudflareQueuePublisher<
  TEvent = unknown,
  TPublishOptions extends Record<string, unknown> = Record<string, unknown>,
  TBatchOptions = unknown,
> implements EventDispatcher<TEvent, TPublishOptions, TBatchOptions> {
  constructor(private readonly queues: Record<string, unknown>) {}

  async publish(topic: string, event: TEvent, options?: TPublishOptions): Promise<void> {
    const queue = this.resolveQueue(topic);
    await queue.send(event, { ...options, contentType: "v8" });
  }

  async publishBatch(topic: string, events: TEvent[], options?: TBatchOptions): Promise<void> {
    if (events.length <= 0) return;
    const queue = this.resolveQueue(topic);
    await queue.sendBatch(
      events.map((event) => ({ body: event, contentType: "v8" })),
      options,
    );
  }

  private resolveQueue(topic: string): CloudflareQueueBinding<TEvent> {
    const queue = this.queues[topic];
    if (!isCloudflareQueueBinding<TEvent>(queue)) {
      throw new Error(`Queue binding is missing for topic: ${topic}`);
    }
    return queue;
  }
}

function isCloudflareQueueBinding<TEvent>(value: unknown): value is CloudflareQueueBinding<TEvent> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { send?: unknown }).send === "function" &&
    typeof (value as { sendBatch?: unknown }).sendBatch === "function"
  );
}
