import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { createDB } from "@/api/db/index.ts";
import { backendEnvSchema, type ENV } from "@/api/domain/infra";
import { processOutbox } from "@/api/domain/infra/eventing/index.ts";
import { getAuth } from "@/api/support/auth/index.ts";
import { cronRegistry } from "@/api/index.ts";
import { OutboxPgRepository } from "@/api/repository/outbox/pg";
import { pinoLogger } from "@repo/observability/logging";
import { CloudflareKV } from "@repo/storage/cloudflare-kv";
import { CloudflareMQ } from "./queue.ts";
import type { CloudflareWorkerBinding } from "./type.ts";

export const cloudflareCronAdapter = async (
  controller: ScheduledController,
  env: ENV & CloudflareWorkerBinding,
  ctx: ExecutionContext,
) => {
  backendEnvSchema.decode(env);
  const db = createDB(env.HYPERDRIVE.connectionString);
  const auth = getAuth({ db, provider: "pg" }, env);
  const kv = new CloudflareKV(env.KVNamespace);
  const q = new CloudflareMQ({ QProducer: env.QProducer });
  ctx.waitUntil(
    cronRegistry
      .handle({ cron: controller.cron, db, auth, kv, env: env, queue: q })
      .finally(async () => {
        try {
          await processOutbox(new OutboxPgRepository(db), q, { topic: "QProducer" });
        } catch (e) {
          pinoLogger.error(
            {
              cron: controller.cron,
              error: e instanceof Error ? e.message : String(e),
            },
            "processOutbox error",
          );
        }
      }),
  );
};
