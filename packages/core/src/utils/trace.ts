import { randomCode } from "@repo/utils/random";

export type Traceparent = {
  traceId: string;
  spanId: string;
  flags: string;
};

export const createTraceId = (): string => randomCode(16);
export const createSpanId = (): string => randomCode(8);
export const createCorrelationId = (): string => randomCode(16);

export const formatTraceparent = (traceId: string, spanId: string, flags = "01"): string =>
  `00-${traceId}-${spanId}-${flags}`;

export function parseTraceparent(traceparent: string | null | undefined): Traceparent | null {
  if (!traceparent) return null;
  const parts = traceparent.split("-");
  if (parts.length !== 4) return null;
  return {
    traceId: parts[1] ?? "",
    spanId: parts[2] ?? "",
    flags: parts[3] ?? "",
  };
}
