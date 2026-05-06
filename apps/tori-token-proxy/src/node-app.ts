import { createApp } from "./app.ts";
import { createTokenProxyServerApp } from "./server-app.ts";
import { startSystemTaskScheduler } from "./system-tasks/index.ts";

let cachedApp: ReturnType<typeof createApp> | null = null;

export function createNodeTokenProxyApp() {
  const created = createTokenProxyServerApp();
  if (created.scheduler) {
    startSystemTaskScheduler(created.scheduler);
  }
  return created.app;
}

export function getNodeTokenProxyApp() {
  if (!cachedApp) {
    cachedApp = createNodeTokenProxyApp();
  }

  return cachedApp;
}
