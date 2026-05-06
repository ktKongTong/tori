import { describe, expect, it } from "vite-plus/test";

import { NoopMQ } from "../src/eventing.ts";

describe("NoopMQ", () => {
  it("accepts publish calls without side effects", async () => {
    const mq = new NoopMQ();

    await expect(mq.publish("topic", { id: "event-1" }, { delaySeconds: 1 })).resolves.toBe(
      undefined,
    );
    await expect(mq.publishBatch("topic", [{ id: "event-1" }])).resolves.toBe(undefined);
  });
});
