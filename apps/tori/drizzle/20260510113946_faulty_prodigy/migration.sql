CREATE TABLE "platform"."connection_credential" (
	"id" text PRIMARY KEY,
	"connection_id" text NOT NULL,
	"proxy_instance_id" text NOT NULL,
	"kind" text NOT NULL,
	"credential_ref" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."token_proxy_connection_session" (
	"id" text PRIMARY KEY,
	"state" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"proxy_instance_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_mode" text DEFAULT 'proxy-token' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"callback_url" text NOT NULL,
	"token_proxy_connect_url" text NOT NULL,
	"token_proxy_code" text,
	"connection_id" text,
	"error" text,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_connection_credential" ON "platform"."connection_credential" ("connection_id","kind") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_token_proxy_connection_session_state" ON "platform"."token_proxy_connection_session" ("state");