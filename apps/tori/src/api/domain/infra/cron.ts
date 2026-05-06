import {
  CronRouter as BaseCronRouter,
  createCronHandler as createBaseCronHandler,
  type CronExpr,
  type CronHandler,
  type CronHandlerFn,
  type ICronHandlerRegistry,
} from "@repo/task/cron";
import type { Auth } from "./auth";
import type { DB } from "./db";
import type { ENV } from "./env";
import type { IMQ } from "./eventing/dispatcher";
import type { IKV } from "./kv";
import { createNoopLoggerFactory, type LoggerFactory } from "./logger";
import { createObservationScopeFromServiceContext, runWithObservationScope } from "./observation";
import type { ServiceContext } from "./service-context";

export type ScheduledCtx = {
  cron: string;
  env: ENV;
  db: DB;
  auth: Auth;
  kv: IKV;
  queue: IMQ;
};

export type { CronExpr, CronHandler, CronHandlerFn, ICronHandlerRegistry };

export const createCronHandler = (id: string, handler: CronHandlerFn<ServiceContext>) =>
  createBaseCronHandler(id, handler);

type CronRouterOptions = {
  createContext: (input: {
    ctx: ScheduledCtx;
    handler: CronHandler<ServiceContext>;
    now: Date;
    loggerFactory: LoggerFactory;
  }) => ServiceContext;
  loggerFactory?: LoggerFactory;
};

export class CronRouter
  extends BaseCronRouter<ScheduledCtx, ServiceContext>
  implements ICronHandlerRegistry<ServiceContext>
{
  constructor(options: CronRouterOptions) {
    const loggerFactory = options.loggerFactory ?? createNoopLoggerFactory;
    super({
      createContext: ({ ctx, handler, now }) =>
        options.createContext({
          ctx,
          handler,
          now,
          loggerFactory,
        }),
      runHandler: (scheduleCtx, fn) =>
        runWithObservationScope(createObservationScopeFromServiceContext(scheduleCtx), fn),
      onHandlerError: ({ ctx, error }) => {
        const logger = loggerFactory({
          traceId: "cron",
          spanId: "cron",
          correlationId: ctx.cron,
          source: "monoark/cron-router",
        });
        logger.error("cron trigger handler error", {
          cron: ctx.cron,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  }
}
