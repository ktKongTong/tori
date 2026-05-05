import { decrypt, encrypt } from "../crypto/index.ts";
import type { ProviderRegistry } from "../provider/registry.ts";
import type { Repository } from "../repository/types.ts";
import type { Connection, SystemTaskDefinition, SystemTaskRun } from "../types.ts";
import {
  createProviderRefreshTaskId,
  createSystemTaskRunId,
  SYSTEM_TASK_KIND_PROVIDER_REFRESH,
} from "./types.ts";

interface SystemTaskDeps {
  repo: Repository;
  registry: ProviderRegistry;
  secret: string;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function taskSummary(
  provider: string,
  scanned: number,
  refreshed: number,
  failed: number,
  skipped: number,
) {
  return {
    provider,
    scanned,
    refreshed,
    failed,
    skipped,
  };
}

export async function ensureDefaultSystemTasks({ repo, registry }: SystemTaskDeps) {
  const now = nowSeconds();

  for (const provider of registry.all()) {
    if (!provider.refreshPolicy) continue;

    await repo.ensureSystemTaskDefinition({
      id: createProviderRefreshTaskId(provider.name),
      kind: SYSTEM_TASK_KIND_PROVIDER_REFRESH,
      provider: provider.name,
      intervalSec: provider.refreshPolicy.intervalSec,
      payload: {
        provider: provider.name,
      },
      nextRunAt: now + provider.refreshPolicy.intervalSec,
    });
  }
}

export async function runDueSystemTasks(deps: SystemTaskDeps) {
  await ensureDefaultSystemTasks(deps);
  const dueDefinitions = await deps.repo.listDueSystemTaskDefinitions(nowSeconds());
  const runs: SystemTaskRun[] = [];

  for (const definition of dueDefinitions) {
    runs.push(await runSystemTaskDefinition(deps, definition));
  }

  return runs;
}

export async function runAllSystemTasks(deps: SystemTaskDeps) {
  await ensureDefaultSystemTasks(deps);
  const definitions = await deps.repo.listSystemTaskDefinitions();
  const runs: SystemTaskRun[] = [];

  for (const definition of definitions) {
    if (!definition.enabled) continue;
    runs.push(await runSystemTaskDefinition(deps, definition, { manual: true }));
  }

  return runs;
}

export async function runSystemTaskById(deps: SystemTaskDeps, taskDefinitionId: string) {
  await ensureDefaultSystemTasks(deps);
  const definition = await deps.repo.getSystemTaskDefinition(taskDefinitionId);
  if (!definition) {
    throw new Error(`system task definition not found: ${taskDefinitionId}`);
  }

  return runSystemTaskDefinition(deps, definition, { manual: true });
}

async function runSystemTaskDefinition(
  deps: SystemTaskDeps,
  definition: SystemTaskDefinition,
  options?: { manual?: boolean },
) {
  const scheduledFor = nowSeconds();
  const runId = createSystemTaskRunId();
  const nextRunAt = scheduledFor + definition.intervalSec;

  await deps.repo.updateSystemTaskDefinition(definition.id, {
    lastTriggeredAt: scheduledFor,
    nextRunAt,
    updatedAt: scheduledFor,
  });

  await deps.repo.createSystemTaskRun({
    id: runId,
    taskDefinitionId: definition.id,
    kind: definition.kind,
    status: "QUEUED",
    scheduledFor,
    createdAt: scheduledFor,
  });

  await deps.repo.updateSystemTaskRun(runId, {
    status: "PROCESSING",
    startedAt: nowSeconds(),
  });

  try {
    const summary = await executeSystemTask(deps, definition, runId);
    const finishedAt = nowSeconds();

    await deps.repo.updateSystemTaskRun(runId, {
      status: "DONE",
      summary,
      errorMessage: null,
      finishedAt,
    });
    await deps.repo.updateSystemTaskDefinition(definition.id, {
      lastRunAt: finishedAt,
      lastRunStatus: "DONE",
      lastError: null,
      nextRunAt: options?.manual ? finishedAt + definition.intervalSec : nextRunAt,
      updatedAt: finishedAt,
    });

    return (await deps.repo.getSystemTaskRun(runId)) as SystemTaskRun;
  } catch (error) {
    const finishedAt = nowSeconds();
    const message = error instanceof Error ? error.message : String(error);

    await deps.repo.updateSystemTaskRun(runId, {
      status: "FAIL",
      errorMessage: message,
      finishedAt,
    });
    await deps.repo.updateSystemTaskDefinition(definition.id, {
      lastRunAt: finishedAt,
      lastRunStatus: "FAIL",
      lastError: message,
      nextRunAt: options?.manual ? finishedAt + definition.intervalSec : nextRunAt,
      updatedAt: finishedAt,
    });

    throw error;
  }
}

async function executeSystemTask(
  deps: SystemTaskDeps,
  definition: SystemTaskDefinition,
  taskRunId: string,
) {
  switch (definition.kind) {
    case SYSTEM_TASK_KIND_PROVIDER_REFRESH:
      return runProviderRefreshTask(deps, definition.provider, taskRunId);
    default:
      throw new Error(`unsupported system task kind: ${definition.kind}`);
  }
}

async function runProviderRefreshTask(
  { repo, registry, secret }: SystemTaskDeps,
  providerName: string,
  taskRunId: string,
) {
  const provider = registry.get(providerName);
  const candidates = (await repo.listConnections()).filter(
    (connection) => connection.provider === providerName && connection.status === "active",
  );

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const connection of candidates) {
    const status = await refreshConnection(repo, secret, provider, connection, taskRunId);
    if (status === "SUCCESS") refreshed += 1;
    else if (status === "FAIL") failed += 1;
    else skipped += 1;
  }

  return taskSummary(providerName, candidates.length, refreshed, failed, skipped);
}

async function refreshConnection(
  repo: Repository,
  secret: string,
  provider: ReturnType<ProviderRegistry["get"]>,
  connection: Connection,
  taskRunId: string,
) {
  const createdAt = nowSeconds();
  const credentials = await repo.getCredentials(connection.id);

  if (!credentials?.refreshToken) {
    await repo.createTokenRefreshLog({
      taskRunId,
      connectionId: connection.id,
      provider: connection.provider,
      status: "SKIP",
      message: "missing refresh token",
      createdAt,
    });
    return "SKIP" as const;
  }

  try {
    const refreshToken = await decrypt(credentials.refreshToken, secret);
    if (!refreshToken) {
      await repo.createTokenRefreshLog({
        taskRunId,
        connectionId: connection.id,
        provider: connection.provider,
        status: "SKIP",
        message: "empty refresh token",
        createdAt,
      });
      return "SKIP" as const;
    }

    const refreshed = await provider.refreshToken(refreshToken);

    const nextRefreshToken = refreshed.refreshToken ?? refreshToken;

    await repo.updateCredentials(connection.id, {
      accessToken: await encrypt(refreshed.accessToken, secret),
      refreshToken: await encrypt(nextRefreshToken, secret),
    });
    await repo.updateConnection(connection.id, {
      updatedAt: createdAt,
      status: "active",
    });
    await repo.createTokenRefreshLog({
      taskRunId,
      connectionId: connection.id,
      provider: connection.provider,
      status: "SUCCESS",
      message: null,
      createdAt,
    });

    return "SUCCESS" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repo.createTokenRefreshLog({
      taskRunId,
      connectionId: connection.id,
      provider: connection.provider,
      status: "FAIL",
      message,
      createdAt,
    });
    return "FAIL" as const;
  }
}
