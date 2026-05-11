import { AsyncLocalStorage } from "node:async_hooks";
import type { drizzle } from "drizzle-orm/node-postgres";
import type { drizzle as drizzleD1 } from "drizzle-orm/d1";

type _PGDB = ReturnType<typeof drizzle>;
export type SqliteDB = ReturnType<typeof drizzleD1>;

export type TX = Parameters<Parameters<_PGDB["transaction"]>[0]>[0];
export type PGDB = _PGDB | TX;
export type DB<T extends "pg" | "sqlite" = "pg"> = T extends "pg" ? PGDB : SqliteDB;

export type DBType = "pg" | "sqlite";
export type DefaultDBType = "pg";

const txCtx = new AsyncLocalStorage<TX>();

export function isImplicitTxActive(): boolean {
  return Boolean(txCtx.getStore());
}

export function withImplicitTx<T extends PGDB | TX>(
  baseDb: T,
  options: { getAllowNested: () => boolean },
): T {
  return new Proxy(baseDb, {
    get(target, prop, receiver) {
      const currentExecutor = txCtx.getStore() ?? target;

      if (prop === "transaction") {
        return async <TResult>(callback: (tx: TX) => Promise<TResult>) => {
          if (currentExecutor !== target) {
            if (!options.getAllowNested()) {
              return callback(currentExecutor as TX);
            }

            return currentExecutor.transaction(async (nestedTx) => {
              return txCtx.run(nestedTx, () => callback(nestedTx as TX));
            });
          }

          return target.transaction(async (newTx) => {
            return txCtx.run(newTx, () => callback(newTx as TX));
          });
        };
      }

      const value = Reflect.get(currentExecutor, prop, receiver);
      if (typeof value === "function") {
        return value.bind(currentExecutor);
      }
      return value;
    },
  });
}
