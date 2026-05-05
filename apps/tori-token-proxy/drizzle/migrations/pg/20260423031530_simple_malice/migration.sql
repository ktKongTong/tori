CREATE TABLE "request_logs" (
	"id" serial PRIMARY KEY,
	"connection_id" text NOT NULL,
	"route_group" text NOT NULL,
	"method" text NOT NULL,
	"target_url" text,
	"status_code" integer,
	"error" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_task_definitions" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"interval_sec" integer NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL,
	"next_run_at" integer NOT NULL,
	"last_triggered_at" integer,
	"last_run_at" integer,
	"last_run_status" text,
	"last_error" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_task_runs" (
	"id" text PRIMARY KEY,
	"task_definition_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"error_message" text,
	"scheduled_for" integer,
	"started_at" integer,
	"finished_at" integer,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_refresh_logs" (
	"id" serial PRIMARY KEY,
	"task_run_id" text,
	"connection_id" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "permissions" text DEFAULT '["proxy","account"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "updated_at" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "last_used_at" integer;