import type { Context } from "hono";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { EnvError } from "@/api/domain/error";
import type { DB } from "@/api/domain/infra/db";
import type { ENV } from "@/api/domain/infra/env";
import { backendEnvSchema } from "@/api/domain/infra/env";
import type { IMQ } from "@/api/domain/infra/eventing/dispatcher";
import type { IKV } from "@/api/domain/infra/kv";

declare module "hono" {
  interface ContextVariableMap {
    appEnv: ENV;
    db: DB;
    kv: IKV;
    mq: IMQ;
  }
}

type ResolveInput<T> = T | ((c: Context) => Promise<T> | T);

export type KVInput = ResolveInput<IKV>;
export type DBInput = ResolveInput<DB>;
export type MQInput = ResolveInput<IMQ>;
export type EnvInput = ResolveInput<unknown>;

async function resolveInput<T>(value: ResolveInput<T>, c: Context): Promise<T> {
  return typeof value === "function" ? await (value as (c: Context) => Promise<T> | T)(c) : value;
}

type Key = "db" | "kv" | "mq";
const getSetMiddleware = (key: Key, input: DBInput | KVInput | MQInput) => {
  return createMiddleware(async (c, next) => {
    c.set(key, await resolveInput(input, c));
    await next();
  });
};

export const kvMiddleware = (kv: KVInput) => getSetMiddleware("kv", kv);

export const envMiddleware = (env: EnvInput) =>
  createMiddleware(async (c, next) => {
    const e = (await resolveInput(env, c)) as ENV;
    // 仅用于验证，因为 cloudflare worker 环境下部分功能接口依赖 ENV 传递
    const result = backendEnvSchema.safeParse(e);
    if (!result.success) {
      c.get("logger")?.error(result.error.issues);
      throw new EnvError(`env not set yet`);
    }
    c.set("appEnv", e);
    await next();
  });

export type AdapterOptions = {
  kv: KVInput;
  db: DBInput;
  mq: MQInput;
  env: EnvInput;
};

export const adapterMiddleware = (adapterOption: AdapterOptions) =>
  createMiddleware(
    every(
      envMiddleware(adapterOption.env),
      getSetMiddleware("db", adapterOption.db),
      getSetMiddleware("mq", adapterOption.mq),
      getSetMiddleware("kv", adapterOption.kv),
    ),
  );
