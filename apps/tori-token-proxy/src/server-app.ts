import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createApp } from "./app.ts";
import { createDefaultProviderRegistry } from "./provider/registry.ts";
import { MemoryRepository } from "./repository/memory.ts";
import { PgRepository } from "./repository/pg/index.ts";
import * as schema from "./repository/pg/schema.ts";
import type { SystemTaskSchedulerDeps } from "./system-tasks/index.ts";

type EnvReader = (name: string) => string | undefined;

export interface TokenProxyServerApp {
  app: ReturnType<typeof createApp>;
  scheduler?: SystemTaskSchedulerDeps;
}

export function createTokenProxyServerApp(
  readEnv: EnvReader = readProcessEnv,
): TokenProxyServerApp {
  console.log("[token-proxy] starting");
  const databaseUrl = readEnv("DATABASE_URL");
  const secret = readEnv("PROXY_SECRET") || createDevSecret(readEnv);
  const adminKey = readEnv("PROXY_ADMIN_KEY") || undefined;

  if (!secret || secret.length < 32) {
    throw new Error("PROXY_SECRET is required (min 32 chars)");
  }

  if (!databaseUrl) {
    if (readEnv("NODE_ENV") === "production") {
      throw new Error("DATABASE_URL is required");
    }

    const repo = new MemoryRepository();
    const registry = createDefaultProviderRegistry();
    console.warn("[token-proxy] DATABASE_URL is not set; using in-memory repository");
    return {
      app: createApp({ repo, secret, adminKey, registry }),
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzle({ client: pool, schema } as never);
  const repo = new PgRepository(db);
  const registry = createDefaultProviderRegistry();

  console.log("[token-proxy] postgres connected");
  return {
    app: createApp({ repo, secret, adminKey, registry }),
    scheduler: { repo, registry, secret },
  };
}

function readProcessEnv(name: string) {
  return globalThis.process?.env?.[name];
}

function createDevSecret(readEnv: EnvReader) {
  if (readEnv("NODE_ENV") === "production") return undefined;

  console.warn("[token-proxy] PROXY_SECRET is not set; using an ephemeral development secret");
  return "dev-token-proxy-secret-000000000000";
}
