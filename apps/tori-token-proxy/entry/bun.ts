import { Hono } from "hono";
import { honoNitroHandler } from "./nitro";
import { createTokenProxyServerApp } from "../src/server-app.ts";
import {
  createSystemTaskSchedulerTick,
  type SystemTaskSchedulerDeps,
} from "../src/system-tasks/index.ts";
import { isApiRequestPath } from "../src/web-app.ts";

const app = new Hono();
const bunRuntime = globalThis as typeof globalThis & {
  Bun?: typeof Bun;
};
const tokenProxyApp = createTokenProxyServerApp((name) => bunRuntime.Bun?.env[name]);

if (tokenProxyApp.scheduler && bunRuntime.Bun) {
  startBunSystemTaskScheduler(tokenProxyApp.scheduler, bunRuntime.Bun);
}

function startBunSystemTaskScheduler(deps: SystemTaskSchedulerDeps, bun: typeof Bun) {
  const tick = createSystemTaskSchedulerTick(deps);
  void tick();
  bun.cron("* * * * *", tick);
}

app.use("*", async (context, next) => {
  if (!isApiRequestPath(new URL(context.req.url).pathname)) {
    await next();
    return;
  }
  return tokenProxyApp.app.fetch(context.req.raw);
});

export default honoNitroHandler(app);
