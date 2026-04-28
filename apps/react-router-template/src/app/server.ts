import { Hono, type ExecutionContext } from "hono";
import { createRequestHandler } from "react-router";
import { createApp, type ServerOptions } from "@/api/app";

type Runtime = "node" | "workerd" | "deno" | "bun";

type CreateRRAppOptions = {
  api: ServerOptions;
  runtime: Runtime;
};

export const createRRApp = ({ api, runtime }: CreateRRAppOptions) => {
  const app = new Hono();

  app.route("/api", createApp(api));

  // 在使用 react-router-hono-server（node/bun/deno) 时
  // 不需要这一部分，这部分会由其进行处理
  // 但对于其他 runtime 而言(workerd)，这是需要的
  if (runtime === "workerd") {
    // known issue
    // 直接使用 wrangler dev 无法正确解析 module
    // 必须借助 vite plugin
    // 但是 vite-plugin 对 cron 的支持存在问题，/__scheduled path 无法触发
    // 需要使用 /cdn-cgi/handler/scheduled
    const requestHandler = createRequestHandler(
      // @ts-ignore
      () => import("virtual:react-router/server-build"),
      import.meta.env.MODE,
    );
    app.all("*", (c) => {
      return requestHandler(c.req.raw, {
        cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
      });
    });
  }
  return app;
};
