import { backendEnvSchema, type ENV } from "@/api/domain/infra/env.ts";
import { createDB } from "@/api/db/index";
import { getAuth } from "@/api/support/auth/index";
import { memoryKV } from "@repo/storage/kv";
import { InProcessMQ } from "./queue";
import { loadEnvFile } from "node:process";

type NodeRuntime = {
  env: ENV;
  db: ReturnType<typeof createDB>;
  auth: ReturnType<typeof getAuth>;
  kv: typeof memoryKV;
  mq: InProcessMQ;
};

declare global {
  var __toriNodeRuntime__: NodeRuntime | undefined;
}

export function getNodeRuntime() {
  loadEnvFile();
  if (globalThis.__toriNodeRuntime__) {
    return globalThis.__toriNodeRuntime__;
  }
  const env = backendEnvSchema.parse(process.env);
  const db = createDB(env.DB_URL || env.DATABASE_URL!);
  const auth = getAuth({ db, provider: "pg" }, env);
  const mq = new InProcessMQ({
    env,
    db,
    kv: memoryKV,
    auth,
  });

  const runtime: NodeRuntime = {
    env,
    db,
    auth,
    kv: memoryKV,
    mq,
  };

  globalThis.__toriNodeRuntime__ = runtime;
  return runtime;
}
