import { honoNitroHandler } from "./nitro";
import { Hono } from "hono";
import { createApp, registerApiV2Runtime } from "@/api";
import { startNodeCronRuntime } from "../adapter/node/cron";
import { getNodeRuntime } from "../adapter/node/runtime";
import { nodeServerAdapter } from "../adapter/node/server";

const app = new Hono();
const runtime = getNodeRuntime();

registerApiV2Runtime();
startNodeCronRuntime({
  env: runtime.env,
  db: runtime.db,
  auth: runtime.auth,
  kv: runtime.kv,
  queue: runtime.mq,
});

app.route(
  "/api",
  createApp({
    adapter: nodeServerAdapter,
  }),
);

export default honoNitroHandler(app);
