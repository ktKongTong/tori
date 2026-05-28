import type { Auth } from "@/api/domain/infra/auth.ts";
import type { DB } from "@/api/domain/infra/db.ts";
import type { ENV } from "@/api/domain/infra/env.ts";
import type { IMQ } from "@/api/domain/infra/eventing/dispatcher";
import type { IKV } from "@/api/domain/infra/kv.ts";
import { pinoLogger } from "@repo/observability/logging";

import { cronRegistry } from "@/api/index.ts";

declare global {
  var __toriNodeCronRuntimeStarted__: boolean | undefined;
}

function millisecondsUntilNextMinute() {
  const now = Date.now();
  return 60_000 - (now % 60_000) + 50;
}

type NodeCronRuntimeDeps = {
  env: ENV;
  db: DB;
  auth: Auth;
  kv: IKV;
  queue: IMQ;
};

export function startNodeCronRuntime(deps: NodeCronRuntimeDeps) {
  if (globalThis.__toriNodeCronRuntimeStarted__) {
    return;
  }

  globalThis.__toriNodeCronRuntimeStarted__ = true;

  const tick = async () => {
    try {
      await cronRegistry.handle({
        cron: "* * * * *",
        env: deps.env,
        db: deps.db,
        auth: deps.auth,
        kv: deps.kv,
        queue: deps.queue,
      });
    } catch (error) {
      pinoLogger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "node cron runtime tick failed",
      );
    } finally {
      setTimeout(tick, 10_000);
    }
  };

  pinoLogger.info("node cron runtime started");
  setTimeout(tick, 10_000);
}
