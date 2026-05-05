import type { ProviderRegistry } from "../provider/registry.ts";
import type { Repository } from "../repository/types.ts";
import { ensureDefaultSystemTasks, runDueSystemTasks } from "./service.ts";

interface SchedulerOptions {
  repo: Repository;
  registry: ProviderRegistry;
  secret: string;
  intervalMs?: number;
}

type SchedulerDeps = Omit<SchedulerOptions, "intervalMs">;

export function createSystemTaskSchedulerTick({ repo, registry, secret }: SchedulerDeps) {
  let running = false;

  return async () => {
    if (running) return;
    running = true;

    try {
      await ensureDefaultSystemTasks({ repo, registry, secret });
      await runDueSystemTasks({ repo, registry, secret });
    } catch (error) {
      console.error("[token-proxy] system task scheduler failed", error);
    } finally {
      running = false;
    }
  };
}

export function startSystemTaskScheduler({
  repo,
  registry,
  secret,
  intervalMs = 60_000,
}: SchedulerOptions) {
  const tick = createSystemTaskSchedulerTick({ repo, registry, secret });

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
