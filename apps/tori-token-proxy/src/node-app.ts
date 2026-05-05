import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createApp } from "./app.ts";
import { createDefaultProviderRegistry } from "./provider/registry.ts";
import { PgRepository } from "./repository/pg/index.ts";
import * as schema from "./repository/pg/schema.ts";
import { startSystemTaskScheduler } from "./system-tasks/index.ts";

let cachedApp: ReturnType<typeof createApp> | null = null;

export function createNodeTokenProxyApp() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.PROXY_SECRET;
  const adminKey = process.env.PROXY_ADMIN_KEY || undefined;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!secret || secret.length < 32) {
    throw new Error("PROXY_SECRET is required (min 32 chars)");
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
