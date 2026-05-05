import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createApp } from "./app.ts";
import { createDefaultProviderRegistry } from "./provider/registry.ts";
import { MemoryRepository } from "./repository/memory.ts";
import { PgRepository } from "./repository/pg/index.ts";
import * as schema from "./repository/pg/schema.ts";
import { startSystemTaskScheduler } from "./system-tasks/index.ts";

let cachedApp: ReturnType<typeof createApp> | null = null;

export function createNodeTokenProxyApp() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.PROXY_SECRET || createDevSecret();
  const adminKey = process.env.PROXY_ADMIN_KEY || undefined;

  if (!secret || secret.length < 32) {
    throw new Error("PROXY_SECRET is required (min 32 chars)");
  }

  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required");
    }

    const repo = new MemoryRepository();
    const registry = createDefaultProviderRegistry();
    console.warn("[token-proxy] DATABASE_URL is not set; using in-memory repository");
    return createApp({ repo, secret, adminKey, registry });
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const db = drizzle({ client: pool, schema });
  const repo = new PgRepository(db);
  const registry = createDefaultProviderRegistry();

  console.log("[token-proxy] postgres connected");
  startSystemTaskScheduler({ repo, registry, secret });
  return createApp({ repo, secret, adminKey, registry });
}

export function getNodeTokenProxyApp() {
  if (!cachedApp) {
    cachedApp = createNodeTokenProxyApp();
  }

  return cachedApp;
}

function createDevSecret() {
  if (process.env.NODE_ENV === "production") return undefined;

  console.warn("[token-proxy] PROXY_SECRET is not set; using an ephemeral development secret");
  return "dev-token-proxy-secret-000000000000";
}
