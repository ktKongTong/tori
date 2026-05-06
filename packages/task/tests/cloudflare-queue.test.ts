import { describe, expect, it } from "vite-plus/test";

import { CloudflareQueuePublisher, type CloudflareQueueMessage } from "../src/cloudflare-queue.ts";

class FakeQueue<TEvent> {
  sent: Array<{ message: TEvent; options?: unknown }> = [];
  batches: Array<{ messages: CloudflareQueueMessage<TEvent>[]; options?: unknown }> = [];

  async send(message: TEvent, options?: unknown): Promise<void> {
    this.sent.push({ message, options });
  }

  async sendBatch(messages: CloudflareQueueMessage<TEvent>[], options?: unknown): Promise<void> {
    this.batches.push({ messages, options });
  }
}

describe("CloudflareQueuePublisher", () => {
  it("publishes single events with v8 content type", async () => {
    const queue = new FakeQueue<{ id: string }>();
    const publisher = new CloudflareQueuePublisher<{ id: string }>({ QProducer: queue });

    await publisher.publish("QProducer", { id: "event-1" }, { delaySeconds: 5 });

    expect(queue.sent).toEqual([
      {
        message: { id: "event-1" },
        options: { delaySeconds: 5, contentType: "v8" },
      },
    ]);
  });

  it("publishes batches with v8 message envelopes", async () => {
    const queue = new FakeQueue<{ id: string }>();
    const publisher = new CloudflareQueuePublisher<{ id: string }>({ QProducer: queue });

    await publisher.publishBatch("QProducer", [{ id: "event-1" }, { id: "event-2" }], {
      delaySeconds: 10,
    });

    expect(queue.batches).toEqual([
      {
        messages: [
          { body: { id: "event-1" }, contentType: "v8" },
          { body: { id: "event-2" }, contentType: "v8" },
        ],
        options: { delaySeconds: 10 },
      },
    ]);
  });

  it("throws when a topic has no queue binding", async () => {
    const publisher = new CloudflareQueuePublisher({});

    await expect(publisher.publish("MissingQueue", { id: "event-1" })).rejects.toThrow(
      "Queue binding is missing for topic: MissingQueue",
    );
  });
});
