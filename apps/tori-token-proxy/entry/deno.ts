import { Hono } from "hono";
import { honoNitroHandler } from "./nitro";
import { createTokenProxyServerApp } from "../src/server-app.ts";
import {
  createSystemTaskSchedulerTick,
  type SystemTaskSchedulerDeps,
} from "../src/system-tasks/index.ts";
import { isApiRequestPath } from "../src/web-app.ts";

const app = new Hono();
const denoRuntime = globalThis as typeof globalThis & {
  Deno?: typeof Deno;
};
const tokenProxyApp = createTokenProxyServerApp((name) => denoRuntime.Deno?.env.get(name));

if (tokenProxyApp.scheduler && denoRuntime.Deno) {
  startDenoSystemTaskScheduler(tokenProxyApp.scheduler, denoRuntime.Deno);
}

function startDenoSystemTaskScheduler(deps: SystemTaskSchedulerDeps, deno: typeof Deno) {
  const tick = createSystemTaskSchedulerTick(deps);
  void tick();
  void deno.cron("token-proxy system tasks", "* * * * *", tick);
}

app.use("*", async (context, next) => {
  if (!isApiRequestPath(new URL(context.req.url).pathname)) {
    await next();
    return;
  }
  return tokenProxyApp.app.fetch(context.req.raw);
});

export default honoNitroHandler(app);
