import type { IMQ } from "../dispatcher";
import type { IOutboxRepository } from "../repository/repository.ts";

const DEFAULT_OUTBOX_BATCH_SIZE = 10;
const DEFAULT_OUTBOX_PROCESSING_TTL_MS = 2 * 60 * 1000;

export type ProcessOutboxOptions = {
  topic: string;
  batchSize?: number;
  processingTtlMs?: number;
};

export const processOutbox = async (
  repo: IOutboxRepository,
  publisher: IMQ,
  options: ProcessOutboxOptions,
) => {
  const batchSize = options.batchSize ?? DEFAULT_OUTBOX_BATCH_SIZE;
  const processingTtlMs = options.processingTtlMs ?? DEFAULT_OUTBOX_PROCESSING_TTL_MS;
  const staleCutoff = new Date(Date.now() - processingTtlMs);

  await repo.markProcessingTimeoutToPending(staleCutoff);

  const { leaseToken, rows } = await repo.markPendingAsProcessing(batchSize);

  if (rows.length <= 0 || !leaseToken) return;

  const ids = rows.map((r) => r.id);

  await publisher.publishBatch(options.topic, rows);

  const updated = await repo.markProcessingAsSent(leaseToken, ids);

  if (updated.length !== ids.length) {
    throw new Error(`outbox finalize mismatch: expected=${ids.length}, updated=${updated.length}`);
  }
};
