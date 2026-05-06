import { createPinoAppLogger } from "@repo/observability/logging";

import type { User } from "@/api/domain/infra/auth.ts";
import type { EventRuntimeContext } from "@/api/domain/infra/eventing/handler.ts";
import { EventRouter } from "@/api/domain/infra/eventing/router.ts";
import { createServiceContext } from "@/api/support/service-context.ts";

export const eventRouter = new EventRouter({
  loggerFactory: createPinoAppLogger,
  createContext: ({ ctx, event, loggerFactory }) => {
    const userId = event.actor?.startsWith("user:") ? event.actor.replace("user:", "") : null;
    return createServiceContext({
      tx: ctx.tx,
      env: ctx.env,
      kv: ctx.kv,
      auth: ctx.auth,
      queue: ctx.queue,
      loggerFactory,
      user: userId ? ({ id: userId } as User) : null,
      traceparent: event.traceparent,
      tracestate: event.tracestate,
      correlationId: event.correlationId,
      causationId: event.id,
      causationType: "event",
      source: "monoark/event-handler",
    }) as EventRuntimeContext;
  },
});
