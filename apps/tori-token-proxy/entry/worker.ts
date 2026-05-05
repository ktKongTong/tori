import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import { createApp } from "../src/app.ts";
import { createDefaultProviderRegistry } from "../src/provider/registry.ts";
import { SqliteRepository } from "../src/repository/sqlite/index.ts";
import * as schema from "../src/repository/sqlite/schema.ts";
import { runDueSystemTasks } from "../src/system-tasks/index.ts";
import { isApiRequestPath } from "../src/web-app.ts";

type Env = {
  DB: D1Database;
  PROXY_SECRET: string;
  PROXY_ADMIN_KEY?: string;
};

function shouldHandleSSR(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isApiRequestPath(pathname)) {
    return false;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") || accept.includes("*/*");
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.PROXY_SECRET || env.PROXY_SECRET.length < 32) {
      return new Response("PROXY_SECRET is required (min 32 chars)", { status: 500 });
    }

    const db = drizzle(env.DB, { schema });
    const repo = new SqliteRepository(db);
    const registry = createDefaultProviderRegistry();
    const app = createApp({
      repo,
      secret: env.PROXY_SECRET,
      adminKey: env.PROXY_ADMIN_KEY,
      registry,
    });

    app.use("*", async (context) => {
      if (!shouldHandleSSR(context.req.raw)) {
        return context.notFound();
      }

      return handler.fetch(context.req.raw);
    });

    return app.fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    if (!env.PROXY_SECRET || env.PROXY_SECRET.length < 32) {
      console.error("[token-proxy] PROXY_SECRET is required (min 32 chars)");
      return;
    }

    const db = drizzle(env.DB, { schema });
    const repo = new SqliteRepository(db);
    const registry = createDefaultProviderRegistry();

    await runDueSystemTasks({
      repo,
      registry,
      secret: env.PROXY_SECRET,
    });
  },
};
