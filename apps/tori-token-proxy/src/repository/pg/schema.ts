import { boolean, integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

// ─── Connections ───

export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerUid: text("provider_uid").notNull(),
  displayName: text("display_name").notNull().default(""),
  label: text("label"),
  tokenInject: text("token_inject").notNull().default("bearer"),
  permissions: text("permissions").notNull().default('["proxy","account"]'),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull().default(""),
  apiKey: text("api_key").notNull().unique("connection_api_key"),
  status: text("status").notNull().default("active"),
  // soft delete
  deletedAt: integer("deleted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

// ─── Auth Codes ───

export const authCodes = pgTable("auth_codes", {
  code: text("code").primaryKey(),
  connectionId: text("connection_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumed: boolean("consumed").notNull().default(false),
});

// ─── Auth Sessions ───

export const authSessions = pgTable("auth_sessions", {
  sid: text("sid").primaryKey(),
  state: text("state").notNull(), // JSON string
  expiresAt: integer("expires_at").notNull(),
});

// ─── OAuth Clients ───

export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientSecret: text("client_secret").notNull(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").notNull(),
  scopes: jsonb("scopes").notNull(),
  policyId: text("policy_id"),
  createdAt: integer("created_at").notNull(),
});

// ─── Proxy Policies & Grants ───

export const proxyPolicies = pgTable("proxy_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  document: jsonb("document").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const proxyGrants = pgTable("proxy_grants", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique("proxy_grants_token_hash_unique"),
  clientId: text("client_id").notNull(),
  connectionId: text("connection_id").notNull(),
  scopes: jsonb("scopes").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

// ─── Settings ───

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const requestLogs = pgTable("request_logs", {
  id: serial("id").primaryKey(),
  connectionId: text("connection_id").notNull(),
  clientId: text("client_id"),
  routeGroup: text("route_group").notNull(),
  method: text("method").notNull(),
  targetUrl: text("target_url"),
  headers: jsonb("headers"),
  query: jsonb("query"),
  requestBody: jsonb("request_body"),
  statusCode: integer("status_code"),
  error: text("error"),
  policyId: text("policy_id"),
  matchedRuleId: text("matched_rule_id"),
  ruleDecision: text("rule_decision"),
  blockedReason: text("blocked_reason"),
  createdAt: integer("created_at").notNull(),
});

export const systemTaskDefinitions = pgTable("system_task_definitions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  intervalSec: integer("interval_sec").notNull(),
  payload: text("payload").notNull().default("{}"),
  nextRunAt: integer("next_run_at").notNull(),
  lastTriggeredAt: integer("last_triggered_at"),
  lastRunAt: integer("last_run_at"),
  lastRunStatus: text("last_run_status"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const systemTaskRuns = pgTable("system_task_runs", {
  id: text("id").primaryKey(),
  taskDefinitionId: text("task_definition_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  errorMessage: text("error_message"),
  scheduledFor: integer("scheduled_for"),
  startedAt: integer("started_at"),
  finishedAt: integer("finished_at"),
  createdAt: integer("created_at").notNull(),
});

export const tokenRefreshLogs = pgTable("token_refresh_logs", {
  id: serial("id").primaryKey(),
  taskRunId: text("task_run_id"),
  connectionId: text("connection_id").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: integer("created_at").notNull(),
});
