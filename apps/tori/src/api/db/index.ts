import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import * as schema from "./schema";
import type { DB, DBType } from "@/api/domain/infra/db";
import { drizzle as d1Drizzle } from "drizzle-orm/d1";

export const createDBFromClient = (client: Client | Pool) => drizzle({ client, schema } as never);

export const createDB = (connection: string) =>
  createDBFromClient(new Pool({ connectionString: connection, maxUses: 1 })) as DB;

export function createD1DB<TSchema extends Record<string, unknown>>(
  database: D1Database,
  schema?: TSchema,
) {
  return schema ? d1Drizzle(database, { schema }) : d1Drizzle(database);
}

export type DBOptions = {
  db: DB<DBType>;
  provider: DBType;
};
