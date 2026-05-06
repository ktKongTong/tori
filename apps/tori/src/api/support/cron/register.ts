import { createPinoAppLogger } from "@repo/observability/logging";
import { CronRouter } from "@/api/domain/infra/cron.ts";
import { createServiceContext } from "@/api/support/service-context.ts";

export const cronRegistry = new CronRouter({
  loggerFactory: createPinoAppLogger,
  createContext: ({ ctx, handler, now, loggerFactory }) =>
    createServiceContext({
      tx: ctx.db,
      env: ctx.env,
      kv: ctx.kv,
      auth: ctx.auth,
      queue: ctx.queue,
      loggerFactory,
      correlationId: ctx.cron,
      causationId: `${handler.id}:${now.toISOString()}`,
      causationType: "cron",
      source: `monoark/cron/${handler.id}`,
      user: null,
      role: undefined,
    }),
});
