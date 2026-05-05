import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Connections ───

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerUid: text("provider_uid").notNull(),
  displayName: text("display_name").notNull().default(""),
  label: text("label"),
  tokenInject: text("token_inject").notNull().default("bearer"),
  permissions: text("permissions", { mode: "json" }).notNull().default('["proxy","account"]'),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull().default(""),
  apiKey: text("api_key").notNull().unique("connections_api_key_unique"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "number" }),
});

// ─── Auth Codes (one-time exchange tokens) ───

export const authCodes = sqliteTable("auth_codes", {
  code: text("code").primaryKey(),
  connectionId: text("connection_id").notNull(),
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
  consumed: integer("consumed", { mode: "boolean" }).notNull().default(false),
});

// ─── Auth Sessions (client-driven polling state) ───

export const authSessions = sqliteTable("auth_sessions", {
  sid: text("sid").primaryKey(),
  state: text("state", { mode: "json" }).notNull(), // JSON AuthSessionState
  expiresAt: integer("expires_at", { mode: "number" }).notNull(),
});

// ─── Proxy Rules ───

export const proxyRules = sqliteTable("proxy_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  allowedHost: text("allowed_host").notNull(),
  pathPattern: text("path_pattern").notNull().default("*"),
  methods: text("methods").notNull().default("GET"),
});

// ─── Settings (encrypted key-value) ───

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const requestLogs = sqliteTable("request_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  connectionId: text("connection_id").notNull(),
  routeGroup: text("route_group").notNull(),
  method: text("method").notNull(),
  targetUrl: text("target_url"),
  statusCode: integer("status_code"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const systemTaskDefinitions = sqliteTable("system_task_definitions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  intervalSec: integer("interval_sec").notNull(),
  payload: text("payload").notNull().default("{}"),
  nextRunAt: integer("next_run_at", { mode: "number" }).notNull(),
  lastTriggeredAt: integer("last_triggered_at", { mode: "number" }),
  lastRunAt: integer("last_run_at", { mode: "number" }),
  lastRunStatus: text("last_run_status"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const systemTaskRuns = sqliteTable("system_task_runs", {
  id: text("id").primaryKey(),
  taskDefinitionId: text("task_definition_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  errorMessage: text("error_message"),
  scheduledFor: integer("scheduled_for", { mode: "number" }),
  startedAt: integer("started_at", { mode: "number" }),
  finishedAt: integer("finished_at", { mode: "number" }),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const tokenRefreshLogs = sqliteTable("token_refresh_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskRunId: text("task_run_id"),
  connectionId: text("connection_id").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
