import { defineConfig } from "drizzle-kit";

const url = process.env.DB_URL!;

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/repository/sqlite/schema.ts",
  out: "./drizzle/migrations/sqlite",
  dbCredentials: { url },
});
