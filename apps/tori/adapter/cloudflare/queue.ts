import type { ExecutionContext } from "@cloudflare/workers-types";
import { createDB } from "@/api/db/index.ts";
import type { ENV, EventEnvelope } from "@/api/domain/infra";
import { processOutbox } from "@/api/domain/infra/eventing/index.ts";
import type { EventDispatcher } from "@/api/domain/infra/eventing/publisher.ts";
import { getAuth } from "@/api/support/auth/index.ts";
import { eventRouter } from "@/api/server/event-router.ts";
import { pinoLogger } from "@repo/observability/logging";
import { CloudflareKV } from "@repo/storage/cloudflare-kv";
import { CloudflareQueuePublisher } from "@repo/task/cloudflare-queue";
import { OutboxPgRepository } from "@/api/domain/infra/eventing/repository/outbox/pg";
import type { CloudflareWorkerBinding } from "./type.ts";

export class CloudflareMQ
  extends CloudflareQueuePublisher<EventEnvelope, any, any>
  implements EventDispatcher<"cf-queue"> {}

export const cloudflareMQAdapter = async (
  batch: MessageBatch<EventEnvelope>,
  env: ENV & CloudflareWorkerBinding,
  ctx: ExecutionContext,
) => {
  console.log("Queue processing");
  const tx = createDB(env.HYPERDRIVE.connectionString);
  const auth = getAuth({ db: tx, provider: "pg" }, env);
  const kv = new CloudflareKV(env.KVNamespace);
  const events = batch.messages.map((it) => it.body);
  pinoLogger.debug({
    msg: "queue batch received",
    count: events.length,
    types: events.map((e) => e.type),
  });
  const queue = new CloudflareMQ({ QProducer: env.QProducer });
  const results = await eventRouter.batchDispatch({ tx, auth, kv, env, queue }, events);

  const messagesByEventId = new Map<string, Message<EventEnvelope>[]>();
  for (const msg of batch.messages) {
    const eventId = msg.body?.id;
    if (!eventId) continue;
    const bucket = messagesByEventId.get(eventId);
    if (bucket) {
      bucket.push(msg);
    } else {
      messagesByEventId.set(eventId, [msg]);
    }
  }

  for (const res of results) {
    const originalMsg = messagesByEventId.get(res.id)?.shift();
    if (!originalMsg) {
      pinoLogger.error({
        msg: "queue result missing original message",
        eventId: res.id,
      });
      continue;
    }
    if (res.status !== "SUCCESS") {
      if (typeof res.delayInSeconds === "number") {
        originalMsg.retry({ delaySeconds: res.delayInSeconds });
      } else {
        originalMsg.retry();
      }
    } else {
      originalMsg.ack();
    }
  }

  try {
    ctx.waitUntil(
      processOutbox(new OutboxPgRepository(tx), new CloudflareMQ({ QProducer: env.QProducer }), {
        topic: "QProducer",
      }),
    );
  } catch (e) {
    pinoLogger.error({
      msg: "processOutbox error",
      error: e instanceof Error ? e.message : "unknown",
    });
  }
};
