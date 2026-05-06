import type { Context } from "hono";
import { getNodeRuntime } from "./runtime";

export const nodeServerAdapter = {
  db: (_ctx: Context) => getNodeRuntime().db,
  kv: (_ctx: Context) => getNodeRuntime().kv,
  mq: (_ctx: Context) => getNodeRuntime().mq,
  env: (_ctx: Context) => getNodeRuntime().env,
};
