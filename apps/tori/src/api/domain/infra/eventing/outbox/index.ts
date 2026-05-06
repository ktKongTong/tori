import { uniqueId } from "@repo/utils/id";
import type { DBType, DefaultDBType } from "../../db.ts";
import type { InfraRepositoryContainer } from "../../repository.ts";
import type { ServiceContext } from "../../service-context.ts";
import type { CausationType } from "../index";

export type { ProcessOutboxOptions } from "./processor";
export { processOutbox } from "./processor";

type EventOption = {
  type: string;
  specVersion?: string;
  subject?: string | null;
  payload?: unknown;
  actor?: string | null;
  source?: string | null;
  extensions?: Record<string, unknown> | null;
  correlationId: string;
  causationId: string;
  causationType: CausationType;
  traceparent?: string | null;
  tracestate?: string | null;
};

export const createOutboxEvent = (opt: EventOption) => {
  return {
    id: uniqueId(),
    type: opt.type,
    specVersion: opt.specVersion ?? "1.0",
    timestamp: BigInt(Date.now()),
    actor: opt.actor ?? null,
    subject: opt.subject ?? null,
    source: opt.source ?? null,
    payload: opt.payload ?? null,
    extensions: opt.extensions ?? null,
    correlationId: opt.correlationId,
    causationId: opt.causationId,
    causationType: opt.causationType,
    traceparent: opt.traceparent ?? null,
    tracestate: opt.tracestate ?? null,
  };
};

type CtxEventOption = {
  type: string;
  specVersion?: string;
  subject?: string | null;
  payload?: unknown;
  actor?: string | null;
  source?: string | null;
  extensions?: Record<string, unknown> | null;
};

export const createOutboxEventFromCtx = <
  TRepositories extends InfraRepositoryContainer = any,
  T extends DBType = DefaultDBType,
>(
  ctx: ServiceContext<TRepositories, T>,
  opt: CtxEventOption,
) => {
  return createOutboxEvent({
    ...opt,
    actor: opt.actor === undefined ? (ctx.user?.id ? `user:${ctx.user.id}` : null) : opt.actor,
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    causationType: ctx.causationType,
    traceparent: ctx.traceparent,
    tracestate: ctx.tracestate,
    source: opt.source ?? ctx.source,
  });
};
