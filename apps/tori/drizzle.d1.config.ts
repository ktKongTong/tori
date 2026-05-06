import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

loadEnvFile();

export default defineConfig({
  schema: process.env.DRIZZLE_D1_SCHEMA ?? "./app/api/db/schema/d1/index.ts",
  out: process.env.DRIZZLE_D1_OUT ?? "./drizzle-d1",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
