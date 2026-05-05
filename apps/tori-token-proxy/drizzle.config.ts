import { defineConfig } from "drizzle-kit";

const isGenerateCommand = process.argv.includes("generate");
const url =
  process.env.DATABASE_URL ??
  (isGenerateCommand
    ? "postgres://placeholder:placeholder@invalid.invalid:5432/token_proxy"
    : (() => {
        throw new Error("DATABASE_URL is required for PostgreSQL drizzle commands");
      })());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/repository/pg/schema.ts",
  out: "./drizzle/migrations/pg",
  dbCredentials: { url },
});
