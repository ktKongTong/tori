import { pgSchema } from "drizzle-orm/pg-core";

export const platformSchema = pgSchema("platform");
export const pgTable = platformSchema.table;
