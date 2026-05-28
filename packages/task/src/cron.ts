import { CronExpressionParser } from "cron-parser";

export type CronExpr = string;

export type CronHandlerFn<TContext> = (ctx: TContext) => Promise<void> | void;

export type CronHandler<TContext> = {
  handler: CronHandlerFn<TContext>;
  id: string;
};

export interface ICronHandlerRegistry<TContext> {
  register(cron: CronExpr, handler: CronHandler<TContext>): void;
}

export type CronRouterOptions<TScheduledContext, TContext> = {
  createContext: (input: {
    ctx: TScheduledContext;
    handler: CronHandler<TContext>;
    now: Date;
  }) => TContext;
  now?: () => Date;
  runHandler?: (ctx: TContext, fn: () => Promise<void> | void) => Promise<void> | void;
  onHandlerError?: (input: {
    ctx: TScheduledContext;
    handler: CronHandler<TContext>;
    error: unknown;
  }) => Promise<void> | void;
};

export function createCronHandler<TContext>(
  id: string,
  handler: CronHandlerFn<TContext>,
): CronHandler<TContext> {
  return { handler, id };
}

export function normalizeCronDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setSeconds(0, 0);
  return normalized;
}

export function isCronDueAt(cron: CronExpr, date: Date): boolean {
  return CronExpressionParser.parse(cron).includesDate(normalizeCronDate(date));
}

export class CronRouter<TScheduledContext, TContext> implements ICronHandlerRegistry<TContext> {
  handlers: Record<string, CronHandler<TContext>[]> = {};
  registrations = new Map<string, { cron: CronExpr; handler: CronHandlerFn<TContext> }>();
  private readonly createContext: CronRouterOptions<TScheduledContext, TContext>["createContext"];
  private readonly now: () => Date;
  private readonly onHandlerError?: CronRouterOptions<
    TScheduledContext,
    TContext
  >["onHandlerError"];
  private readonly runHandler?: CronRouterOptions<TScheduledContext, TContext>["runHandler"];

  constructor(options: CronRouterOptions<TScheduledContext, TContext>) {
    this.createContext = options.createContext;
    this.now = options.now ?? (() => new Date());
    this.runHandler = options.runHandler;
    this.onHandlerError = options.onHandlerError;
  }

  register(cron: CronExpr, handler: CronHandler<TContext>): void {
    const existing = this.registrations.get(handler.id);
    if (existing) {
      if (existing.cron === cron && existing.handler === handler.handler) {
        return;
      }
      throw new Error(`CronHandlerId Conflict ${handler.id}`);
    }
    this.registrations.set(handler.id, { cron, handler: handler.handler });
    if (this.handlers[cron]) {
      this.handlers[cron].push(handler);
    } else {
      this.handlers[cron] = [handler];
    }
  }

  async handle(ctx: TScheduledContext): Promise<void> {
    const now = normalizeCronDate(this.now());
    const handlers = Object.entries(this.handlers).flatMap(([cron, handlers]) =>
      isCronDueAt(cron, now) ? handlers : [],
    );
    await Promise.all(
      handlers.map(async (handler) => {
        console.log("handing cron", handler.id);
        const scheduleCtx = this.createContext({ ctx, handler, now });
        try {
          await (this.runHandler
            ? this.runHandler(scheduleCtx, () => handler.handler(scheduleCtx))
            : handler.handler(scheduleCtx));
        } catch (error) {
          await this.onHandlerError?.({ ctx, handler, error });
        }
      }),
    );
  }
}
