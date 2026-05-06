import type { Auth } from "@/api/domain/infra/auth.ts";
import type { DB } from "@/api/domain/infra/db.ts";
import type { ENV } from "@/api/domain/infra/env.ts";
import type { EventEnvelope } from "@/api/domain/infra/eventing/message.ts";
import type { EventDispatcher } from "@/api/domain/infra/eventing/publisher.ts";
import type { IKV } from "@/api/domain/infra/kv.ts";
import { eventRouter } from "@/api/server/event-router.ts";

type InProcessMQOptions = {
  env: ENV;
  db: DB;
  kv: IKV;
  auth: Auth;
};

export class InProcessMQ implements EventDispatcher<"upstash-queue"> {
  constructor(private readonly options: InProcessMQOptions) {}

  async publish<E>(_topic: string, event: EventEnvelope<E>): Promise<void> {
    await this.publishBatch(_topic, [event]);
  }

  async publishBatch<E>(_topic: string, events: EventEnvelope<E>[]): Promise<void> {
    await eventRouter.batchDispatch(
      {
        env: this.options.env,
        tx: this.options.db,
        kv: this.options.kv,
        auth: this.options.auth,
        queue: this,
      },
      events,
    );
  }
}
