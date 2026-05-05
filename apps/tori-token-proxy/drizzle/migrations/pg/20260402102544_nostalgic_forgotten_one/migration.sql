CREATE TABLE "auth_codes" (
	"code" text PRIMARY KEY,
	"connection_id" text NOT NULL,
	"expires_at" integer NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"sid" text PRIMARY KEY,
	"state" text NOT NULL,
	"expires_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_uid" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"token_inject" text DEFAULT 'bearer' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text DEFAULT '' NOT NULL,
	"api_key" text NOT NULL CONSTRAINT "connection_api_key" UNIQUE,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proxy_rules" (
	"id" serial PRIMARY KEY,
	"provider" text NOT NULL,
	"allowed_host" text NOT NULL,
	"path_pattern" text DEFAULT '*' NOT NULL,
	"methods" text DEFAULT 'GET' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
