import type { CausationType } from "./index.js";

export interface EventEnvelope<T = unknown> {
  id: string;
  type: string;
  source: string | null;
  specVersion: string;
  timestamp: bigint;
  correlationId: string;
  causationId: string;
  causationType: CausationType;
  traceparent: string | null;
  tracestate: string | null;
  actor: string | null;
  subject: string | null;
  payload: T | null;
  extensions: Record<string, unknown> | null;
}
