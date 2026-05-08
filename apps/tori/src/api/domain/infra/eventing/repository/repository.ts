import type { EventEnvelope } from "../../eventing/message.ts";

export interface IOutboxRepository {
  markProcessingTimeoutToPending(staleCutoff: Date): Promise<void>;
  markPendingAsProcessing(limit: number): Promise<{
    leaseToken: string | null;
    rows: EventEnvelope<unknown>[];
  }>;
  markProcessingAsSent(leaseToken: string, ids: string[]): Promise<{ id: string }[]>;
  insertEvent(event: EventEnvelope<unknown>): Promise<void>;
  batchInsertEvent(events: EventEnvelope<unknown>[]): Promise<void>;
}

export type InboxInsert = {
  status: "DONE" | "PROCESSING" | "FAIL";
  eventId: string;
  handlerId: string;
  spanId?: string | null | undefined;
  extensions?: unknown;
  traceparent?: string | null | undefined;
  tracestate?: string | null | undefined;
  processedAt?: Date | null | undefined;
  finishedAt?: Date | null | undefined;
  reason?: string | null | undefined;
};

export type InboxHandleRequest = {
  eventId: string;
  handlerId: string;
  spanId: string;
  traceparent: string | null | undefined;
  tracestate: string | null | undefined;
};

export type InboxHandleResult = {
  eventId: string;
  handlerId: string;
  status: "DONE" | "PROCESSING" | "FAIL";
  reason: string | null | undefined;
};

export interface IInboxRepository {
  insertInbox(event: InboxInsert): Promise<
    | {
        status: "DONE" | "PROCESSING" | "FAIL";
      }
    | undefined
    | null
  >;
  batchInsertInbox(events: EventEnvelope<unknown>[]): Promise<void>;
  getHandlerResult(
    evtId: string,
    handlerId: string,
  ): Promise<
    | {
        status: "DONE" | "PROCESSING" | "FAIL";
        reason: string | null;
      }
    | null
    | undefined
  >;
  markFailedInboxAsProcessing(inbox: InboxHandleRequest): Promise<
    | {
        status: "DONE" | "PROCESSING" | "FAIL";
      }
    | undefined
    | null
  >;
  markProcessingInboxAsCompleted(result: InboxHandleResult): Promise<void>;
}
