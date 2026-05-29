CREATE TABLE "proxy_grants" (
	"id" text PRIMARY KEY,
	"token_hash" text NOT NULL CONSTRAINT "proxy_grants_token_hash_unique" UNIQUE,
	"client_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL,
	"last_used_at" integer
);
--> statement-breakpoint
CREATE TABLE "proxy_policies" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text,
	"document" jsonb NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
DROP TABLE "proxy_rules";--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD COLUMN "policy_id" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "policy_id" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "matched_rule_id" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "rule_decision" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "blocked_reason" text;