import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

loadEnvFile();
export default defineConfig({
  schema: "./src/api/db/schema/pg/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
