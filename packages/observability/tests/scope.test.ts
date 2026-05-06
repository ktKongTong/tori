import { describe, expect, it } from "vite-plus/test";
import {
  attachJournalSink,
  createChildObservationScope,
  createObservationScopeFromServiceContext,
  getObservationScope,
  runWithObservationScope,
} from "../src/scope.ts";

const source = {
  traceId: "0af7651916cd43dd8448eb211c80319c",
  spanId: "b9c7c989f97918e1",
  traceparent: "00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01",
  tracestate: null,
  correlationId: "corr-1",
};

describe("observation scope", () => {
  it("creates a scope from trace context", () => {
    expect(createObservationScopeFromServiceContext(source)).toMatchObject({
      traceId: source.traceId,
      spanId: source.spanId,
      correlationId: source.correlationId,
    });
  });

  it("runs with async-local scope", () => {
    const scope = createObservationScopeFromServiceContext(source);

    runWithObservationScope(scope, () => {
      expect(getObservationScope()).toBe(scope);
    });
  });

  it("carries journal sink into child scopes", () => {
    const sink = { write: () => {} };
    const scope = attachJournalSink(createObservationScopeFromServiceContext(source), sink, {
      event: "test",
    });
    const child = createChildObservationScope(scope);

    expect(child.journalSink).toBe(sink);
    expect(child.journalAttrs).toEqual({ event: "test" });
    expect(child.traceparent).toContain(child.spanId);
  });
});
