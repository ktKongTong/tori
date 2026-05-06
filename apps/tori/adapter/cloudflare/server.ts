import type { Context } from "hono";
import { CloudflareKV } from "@repo/storage/cloudflare-kv";
import { CloudflareMQ } from "./queue";
import { createDB } from "@/api/db/index";

export const cloudflareServerAdapter = {
  db: (ctx: Context) => createDB(ctx.env.HYPERDRIVE.connectionString),
  kv: (ctx: Context) => new CloudflareKV(ctx.env.KVNamespace),
  mq: (ctx: Context) => new CloudflareMQ(ctx.env),
  env: (ctx: Context) => ctx.env,
};
