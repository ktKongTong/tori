import type { LoggerFactory } from "../logger.ts";
import { createNoopLoggerFactory } from "../logger.ts";
import {
  createObservationScopeFromServiceContext,
  runWithObservationScope,
  traceStep,
} from "../observation.ts";
import type {
  EventContext,
  EventHandler,
  EventHandlerResult,
  EventRuntimeContext,
  EvtHandler,
} from "./handler.js";
import type { EventEnvelope } from "./message.ts";

export type EventConsumer<T = unknown> = {
  id: string;
  type: string;
  handler: EventHandler<EventEnvelope<T>>;
};

export function createEventHandler<T>(h: EventHandler<EventEnvelope<T>>) {
  return h;
}

export function createEventConsumer<T>(
  id: string,
  eventType: string,
  h: EventHandler<EventEnvelope<T>>,
): EventConsumer<T> {
  return { id, type: eventType, handler: h };
}

export interface IEventHandler {
  register<T>(
    id: string,
    eventType: string,
    handler: EventHandler<EventEnvelope<T>>,
  ): IEventHandler;
  registerConsumer(...c: EventConsumer[]): IEventHandler;
}

type EventRouterOptions = {
  createContext?: (input: {
    ctx: Omit<EventContext, "event">;
    event: EventEnvelope;
    loggerFactory: LoggerFactory;
  }) => EventRuntimeContext;
  loggerFactory?: LoggerFactory;
};

export class EventRouter implements IEventHandler {
  private handlerIdSet: Set<string> = new Set();
  private handlers: Record<string, EvtHandler[]> = {};
  private registrations = new Map<string, EventConsumer>();
  protected readonly loggerFactory: LoggerFactory;
  private readonly createContext?: EventRouterOptions["createContext"];

  constructor(options: EventRouterOptions = {}) {
    this.loggerFactory = options.loggerFactory ?? createNoopLoggerFactory;
    this.createContext = options.createContext;
  }

  registerConsumer(...c: EventConsumer<never>[]): IEventHandler {
    for (const item of c) {
      this.register(item.id, item.type, item.handler);
    }
    return this;
  }

  register<T>(id: string, eventType: string, handler: EventHandler<EventEnvelope<T>>): EventRouter {
    const existing = this.registrations.get(id);
    if (existing) {
      if (existing.type === eventType && existing.handler === handler) {
        return this;
      }
      throw new Error(`EventHandlerId Conflict ${id}`);
    }
    this.handlerIdSet.add(id);
    this.registrations.set(id, {
      id: id,
      type: eventType,
      handler: handler as EventConsumer["handler"],
    });
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push({ id, handle: handler as EvtHandler["handle"] });
    return this;
  }

  async handleSingleHandler(
    ctx: EventRuntimeContext,
    handler: EvtHandler,
  ): Promise<EventHandlerResult> {
    ctx.updateSourceName(`monoark/handler/${handler.id}`);
    const repo = ctx.repositories.inbox;
    const handlerCtx = ctx;
    const evtLog = await repo.insertInbox({
      eventId: ctx.event.id,
      handlerId: handler.id,
      spanId: ctx.spanId,
      traceparent: ctx.traceparent,
      tracestate: ctx.tracestate,
      status: "PROCESSING",
      processedAt: new Date(),
    });
    if (!evtLog) {
      const reclaimed = await repo.markFailedInboxAsProcessing({
        traceparent: ctx.traceparent,
        tracestate: ctx.tracestate,
        spanId: ctx.spanId,
        eventId: ctx.event.id,
        handlerId: handler.id,
      });
      if (!reclaimed) {
        const existing = await repo.getHandlerResult(ctx.event.id, handler.id);
        if (existing?.status === "DONE") {
          return { id: ctx.event.id, status: "SUCCESS" };
        }
        if (existing?.status === "PROCESSING") {
          return {
            id: ctx.event.id,
            status: "FAIL",
            reason: `handler [${handler.id}] still processing`,
            delayInSeconds: 30,
          };
        }
        return {
          id: ctx.event.id,
          status: "FAIL",
          reason: existing?.reason ?? `handler [${handler.id}] previous execution failed`,
        };
      }
    }

    handlerCtx.logger.debug("handler start", { eventType: ctx.event.type, handlerId: handler.id });
    let status: "DONE" | "FAIL" = "FAIL";
    let reason: string | undefined;
    try {
      const res = await traceStep(
        handlerCtx,
        {
          name: `event.handler.${handler.id}`,
          attrs: {
            "event.id": ctx.event.id,
            "event.type": ctx.event.type,
            "event.handler_id": handler.id,
          },
        },
        () => handler.handle(handlerCtx),
      );
      if (res.status === "SUCCESS") {
        status = "DONE";
      } else if (res.status === "DROP") {
        status = "DONE";
        reason = res.reason ?? "dropped";
      } else {
        status = "FAIL";
        reason = res.reason;
      }
      return res;
    } catch (e) {
      handlerCtx.logger.error("handler error", {
        error: e instanceof Error ? e.message : "unknown",
      });
      status = "FAIL";
      reason = e instanceof Error ? e.stack || e.message : "unknown";
      return { id: ctx.event.id, status: "FAIL", reason: reason };
    } finally {
      await repo.markProcessingInboxAsCompleted({
        eventId: ctx.event.id,
        handlerId: handler.id,
        status,
        reason,
      });
    }
  }

  async dispatch(ctx: EventRuntimeContext): Promise<EventHandlerResult> {
    return await runWithObservationScope(
      createObservationScopeFromServiceContext(ctx),
      async (): Promise<EventHandlerResult> => {
        try {
          const handlers = this.handlers[ctx.event.type] || [];
          if (handlers.length === 0) {
            return { id: ctx.event.id, status: "SUCCESS" };
          }
          const results = await Promise.all(handlers.map((h) => this.handleSingleHandler(ctx, h)));
          const failed = results.find((it) => it.status === "FAIL");
          if (failed) {
            return {
              id: ctx.event.id,
              status: "FAIL",
              reason: failed.reason,
              delayInSeconds: failed.delayInSeconds,
            };
          }
          return { id: ctx.event.id, status: "SUCCESS" };
        } catch (e) {
          ctx.logger.error("event dispatch error", {
            error: e instanceof Error ? e.message : "unknown",
          });
          return { id: ctx.event.id, status: "FAIL", reason: "unknown" };
        }
      },
    );
  }

  async batchDispatch(
    ctx: Omit<EventContext, "logger" | "event" | "serviceContext">,
    events: EventEnvelope[],
  ): Promise<EventHandlerResult[]> {
    const evts = events
      .map((it) => this.createSvcCtxFromEvtCtx(it, ctx))
      .map((c) => this.dispatch(c));
    return await Promise.all(evts);
  }

  private createSvcCtxFromEvtCtx(evt: EventEnvelope, ctx: Omit<EventContext, "event">) {
    if (!this.createContext) {
      throw new Error("EventRouter requires createContext for batchDispatch");
    }

    const res = this.createContext({
      ctx,
      event: evt,
      loggerFactory: this.loggerFactory,
    });
    res.event = evt;
    return res;
  }
}
