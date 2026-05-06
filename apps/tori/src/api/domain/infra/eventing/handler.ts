import type { Auth } from "../auth";
import type { DB } from "../db";
import type { ENV } from "../env";
import type { IKV } from "../kv";
import type { ServiceContext } from "../service-context";
import type { IMQ } from "./dispatcher";
import type { EventEnvelope } from "./message";

export type EventRuntimeContext<T extends EventEnvelope = EventEnvelope> = Omit<
  EventContext<T>,
  "tx"
> &
  ServiceContext;

// single event for single handler
export type EventHandler<T extends EventEnvelope> = (
  c: EventRuntimeContext<T>,
) => Promise<EventHandlerResult>;

export type EvtHandler = {
  id: string;
  handle: <T extends EventEnvelope>(c: EventRuntimeContext<T>) => Promise<EventHandlerResult>;
};

export type EventContext<T extends EventEnvelope = EventEnvelope> = {
  env: ENV;
  tx: DB;
  kv: IKV;
  auth: Auth;
  queue: IMQ;
  event: T;
};

export type ProcessStatus = "SUCCESS" | "FAIL" | "DROP";

export type EventHandlerResult = {
  id: string;
  status: ProcessStatus;
  delayInSeconds?: number;
  reason?: string;
};
