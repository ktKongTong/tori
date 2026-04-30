import { getJson, joinObjectKey, type ObjectStore } from "@repo/storage";
import { createArchiveLogTransport } from "../src/logging/sinks/archive.ts";
import type { ExecutionLogManifest } from "../src/logging/event.ts";

export type ArchiveTransportOptions = {
  service: string;
  namespace?: string;
  environment?: string;
  now?: () => Date;
};

export function createObjectStoreArchiveTransport(
  store: ObjectStore,
  options: ArchiveTransportOptions,
) {
  const keyPrefix = joinObjectKey(options.namespace, options.environment);
  return createArchiveLogTransport({
    service: options.service,
    keyPrefix,
    now: options.now,
    writer: {
      async write(key, body) {
        await store.put({
          key,
          body,
          contentType: key.endsWith(".json") ? "application/json" : "application/x-ndjson",
        });
      },
    },
  });
}

export async function readExecutionManifest(
  store: ObjectStore,
  options: ArchiveTransportOptions,
  executionId: string,
  date: Date,
) {
  return getJson<ExecutionLogManifest>(
    store,
    manifestObjectKey(options.service, executionId, date, options.namespace, options.environment),
  );
}

function manifestObjectKey(
  service: string,
  executionId: string,
  date: Date,
  namespace?: string,
  environment?: string,
) {
  return joinObjectKey(
    namespace,
    environment,
    "logs",
    service,
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    "executions",
    executionId,
    "manifest.json",
  );
}
