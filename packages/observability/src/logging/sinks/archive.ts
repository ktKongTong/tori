import { LoggerlessTransport, type LogLayerTransportParams } from "@loglayer/transport";
import type { ExecutionEntryManifest, ExecutionLogEvent, ExecutionLogManifest } from "../event.ts";
import { isExecutionLogEvent } from "../event.ts";

export type ArchiveObjectWriter = {
  write(key: string, body: string): void | Promise<void>;
};

export type ArchiveLogTransportOptions = {
  service: string;
  writer: ArchiveObjectWriter;
  now?: () => Date;
  keyPrefix?: string;
};

export class ArchiveLogTransport extends LoggerlessTransport {
  private readonly entries = new Map<string, ExecutionLogEvent[]>();
  private readonly manifests = new Map<string, ExecutionLogManifest>();
  private readonly now: () => Date;

  constructor(private readonly options: ArchiveLogTransportOptions) {
    super({ id: "execution-archive" });
    this.now = options.now ?? (() => new Date());
  }

  shipToLogger({ data }: LogLayerTransportParams): unknown[] {
    const event = data?.event;
    if (!isExecutionLogEvent(event)) return [];
    const entryKey = `${event.executionId}:${event.entryId ?? "execution"}`;
    const list = this.entries.get(entryKey) ?? [];
    list.push(event);
    this.entries.set(entryKey, list);
    updateManifest(
      this.manifests,
      event,
      objectKeyFor(this.options.service, event, this.options.keyPrefix, this.now),
    );
    return [];
  }

  async flush() {
    await Promise.all(
      Array.from(this.entries.values()).map(async (events) => {
        const first = events[0];
        if (!first) return;
        const key = objectKeyFor(this.options.service, first, this.options.keyPrefix, this.now);
        await this.options.writer.write(
          key,
          events.map((event) => JSON.stringify(event)).join("\n"),
        );
      }),
    );
  }

  async finalizeExecution(executionId: string): Promise<ExecutionLogManifest> {
    await this.flush();
    const manifest = this.manifests.get(executionId) ?? {
      executionId,
      status: "running",
      startedAt: this.now().toISOString(),
      entries: [],
    };
    await this.options.writer.write(
      manifestKeyFor(this.options.service, executionId, this.options.keyPrefix, this.now),
      JSON.stringify(manifest),
    );
    return manifest;
  }
}

export function createArchiveLogTransport(options: ArchiveLogTransportOptions) {
  return new ArchiveLogTransport(options);
}

function objectKeyFor(
  service: string,
  event: ExecutionLogEvent,
  keyPrefix: string | undefined,
  now: () => Date,
) {
  const date = now();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const prefix = keyPrefix ? `${keyPrefix.replace(/\/$/, "")}/` : "";
  const entryId = event.entryId ?? "execution";
  return `${prefix}logs/${service}/${yyyy}/${mm}/${dd}/executions/${event.executionId}/entries/${entryId}.jsonl`;
}

function manifestKeyFor(
  service: string,
  executionId: string,
  keyPrefix: string | undefined,
  now: () => Date,
) {
  const date = now();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const prefix = keyPrefix ? `${keyPrefix.replace(/\/$/, "")}/` : "";
  return `${prefix}logs/${service}/${yyyy}/${mm}/${dd}/executions/${executionId}/manifest.json`;
}

function updateManifest(
  manifests: Map<string, ExecutionLogManifest>,
  event: ExecutionLogEvent,
  objectKey: string,
) {
  const manifest = manifests.get(event.executionId) ?? {
    executionId: event.executionId,
    status: "running",
    startedAt: event.timestamp,
    entries: [],
  };
  const entryId = event.entryId ?? "execution";
  let entry = manifest.entries.find((item) => item.entryId === entryId);
  if (!entry) {
    entry = {
      entryId,
      kind: event.entry?.kind ?? "execution",
      status: "running",
      startedAt: event.timestamp,
      objectKey,
      eventCount: 0,
      errorCount: 0,
    } satisfies ExecutionEntryManifest;
    manifest.entries.push(entry);
  }
  entry.eventCount += 1;
  entry.errorCount += event.level === "error" ? 1 : 0;
  entry.firstTimestamp ??= event.timestamp;
  entry.lastTimestamp = event.timestamp;
  if (event.kind === "entry.completed") entry.status = "success";
  if (event.kind === "entry.failed") entry.status = "failed";
  if (event.kind === "execution.completed") manifest.status = "success";
  if (event.kind === "execution.failed") manifest.status = "failed";
  if (event.kind === "entry.completed" || event.kind === "entry.failed")
    entry.endedAt = event.timestamp;
  if (event.kind === "execution.completed" || event.kind === "execution.failed")
    manifest.endedAt = event.timestamp;
  manifests.set(event.executionId, manifest);
}
