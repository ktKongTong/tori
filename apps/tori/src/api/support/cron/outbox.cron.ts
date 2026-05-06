import { processOutbox } from "@/api/domain/infra/eventing/index.ts";
import { createCronHandler } from "@/api/domain/infra/cron";

export const outboxCron = createCronHandler("process-outbox", async (c) => {
  c.logger.debug("processing outbox evt");
  await processOutbox(c.repositories.outbox, c.queue, { topic: "QProducer" });
});
