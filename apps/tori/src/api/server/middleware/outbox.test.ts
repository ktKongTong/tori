import { describe, expect, it } from "vite-plus/test";
import type { EventEnvelope } from "../../domain/infra/eventing/message.ts";
import { processOutbox } from "../../domain/infra/eventing/outbox/processor.ts";
import type { IOutboxRepository } from "../../domain/infra/eventing/repository/repository.ts";
import type { IMQ } from "../../domain/infra/index.ts";

type PublishBatchCall = {
  topic: string;
  events: EventEnvelope<unknown>[];
  options?: unknown;
};

class MockPublisher implements IMQ {
  publishBatchCalls: PublishBatchCall[] = [];
  publishCalls: Array<{ topic: string; event: EventEnvelope<unknown>; options?: unknown }> = [];

  async publish<E>(topic: string, event: EventEnvelope<E>, options?: unknown): Promise<void> {
    this.publishCalls.push({ topic, event, options });
  }

  async publishBatch<E>(
    topic: string,
    events: EventEnvelope<E>[],
    options?: unknown,
  ): Promise<void> {
    this.publishBatchCalls.push({ topic, events, options });
  }
}

type ClaimedOutboxRows = Awaited<ReturnType<IOutboxRepository["markPendingAsProcessing"]>>;
type SentOutboxRows = Awaited<ReturnType<IOutboxRepository["markProcessingAsSent"]>>;

class MockOutboxRepository implements IOutboxRepository {
  staleCutoffs: Date[] = [];
  claimLimits: number[] = [];
  sentCalls: Array<{ leaseToken: string; ids: string[] }> = [];

  constructor(
    private readonly claimed: ClaimedOutboxRows = { leaseToken: null, rows: [] },
    private readonly sent: SentOutboxRows = [],
  ) {}

  async markProcessingTimeoutToPending(staleCutoff: Date): Promise<void> {
    this.staleCutoffs.push(staleCutoff);
  }

  async markPendingAsProcessing(limit: number): Promise<ClaimedOutboxRows> {
    this.claimLimits.push(limit);
    return this.claimed;
  }

  async markProcessingAsSent(leaseToken: string, ids: string[]): Promise<SentOutboxRows> {
    this.sentCalls.push({ leaseToken, ids });
    return this.sent;
  }

  async insertEvent(): Promise<void> {}

  async batchInsertEvent(): Promise<void> {}
}

const createEvent = (id: string, correlationId: string): EventEnvelope => ({
  id,
  type: "Test",
  source: "monoark/test",
  specVersion: "1.0",
  timestamp: BigInt(Date.now()),
  correlationId,
  causationId: "cause-1",
  causationType: "req",
  traceparent: null,
  tracestate: null,
  actor: null,
  subject: null,
  payload: null,
  extensions: null,
});

describe("Outbox Processor", () => {
  it("should do nothing when there is no pending event", async () => {
    const mockPublisher = new MockPublisher();
    const repo = new MockOutboxRepository();

    await processOutbox(repo, mockPublisher, { topic: "QProducer" });

    expect(repo.staleCutoffs).toHaveLength(1);
    expect(repo.claimLimits).toEqual([10]);
    expect(mockPublisher.publishBatchCalls).toHaveLength(0);
    expect(repo.sentCalls).toHaveLength(0);
  });

  it("should reclaim, claim, publish and finalize outbox records", async () => {
    const mockPublisher = new MockPublisher();
    const events = [createEvent("evt-1", "corr-1"), createEvent("evt-2", "corr-2")];
    const repo = new MockOutboxRepository({ leaseToken: "lease-1", rows: events }, [
      { id: "evt-1" },
      { id: "evt-2" },
    ]);

    await processOutbox(repo, mockPublisher, { topic: "QProducer" });

    expect(mockPublisher.publishBatchCalls).toEqual([
      { topic: "QProducer", events, options: undefined },
    ]);
    expect(repo.sentCalls).toEqual([{ leaseToken: "lease-1", ids: ["evt-1", "evt-2"] }]);
  });

  it("should throw when finalize updated rows mismatch", async () => {
    const mockPublisher = new MockPublisher();
    const repo = new MockOutboxRepository({
      leaseToken: "lease-1",
      rows: [createEvent("evt-1", "corr-1")],
    });

    await expect(processOutbox(repo, mockPublisher, { topic: "QProducer" })).rejects.toThrow(
      "outbox finalize mismatch",
    );
  });
});
