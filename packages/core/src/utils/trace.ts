export type Traceparent = {
  traceId: string;
  spanId: string;
  flags: string;
};

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const createTraceId = (): string => randomHex(16);
export const createSpanId = (): string => randomHex(8);
export const createCorrelationId = (): string => crypto.randomUUID().replaceAll("-", "");

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
