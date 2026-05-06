CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "task";
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "steam";
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp(6) with time zone,
	"refresh_token_expires_at" timestamp(6) with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."apikey" (
	"id" text PRIMARY KEY UNIQUE,
	"config_id" text NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp(6) with time zone,
	"enabled" boolean,
	"rate_limit_enabled" boolean,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer,
	"remaining" integer,
	"last_request" timestamp(6) with time zone,
	"expires_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"is_anonymous" boolean,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp(6) with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"merged_into_user_id" text
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task"."definition" (
	"id" text PRIMARY KEY,
	"owner_user_id" text,
	"kind" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"schedule" text NOT NULL,
	"payload" jsonb NOT NULL,
	"last_triggered_at" timestamp DEFAULT now() NOT NULL,
	"last_run_at" timestamp DEFAULT now() NOT NULL,
	"last_run_status" text,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task"."run" (
	"id" text PRIMARY KEY,
	"task_definition_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb,
	"error_message" text,
	"scheduled_for" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox" (
	"event_id" varchar,
	"handler_id" varchar,
	"span_id" varchar,
	"traceparent" varchar,
	"tracestate" varchar,
	"extensions" jsonb,
	"status" varchar NOT NULL,
	"processed_at" timestamp,
	"finished_at" timestamp,
	"reason" varchar,
	CONSTRAINT "inbox_pkey" PRIMARY KEY("event_id","handler_id")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" varchar PRIMARY KEY,
	"source" varchar,
	"type" varchar NOT NULL,
	"correlation_id" varchar NOT NULL,
	"causation_id" varchar NOT NULL,
	"causation_type" varchar NOT NULL,
	"spec_version" varchar NOT NULL,
	"timestamp" bigint NOT NULL,
	"actor" varchar,
	"subject" varchar,
	"payload" jsonb,
	"extensions" jsonb,
	"traceparent" varchar,
	"tracestate" varchar,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"lease_token" varchar,
	"processing_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "otel_event_logs" (
	"id" serial PRIMARY KEY,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"seq" integer NOT NULL,
	"level" text NOT NULL,
	"msg" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."audit_log" (
	"id" text PRIMARY KEY,
	"actor_user_id" text,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."channel" (
	"id" text PRIMARY KEY,
	"type" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."user_profile" (
	"user_id" text PRIMARY KEY,
	"display_name" text,
	"avatar_url" text,
	"locale" text,
	"timezone" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."binding_grant" (
	"id" text PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"token_hash" text NOT NULL UNIQUE,
	"purpose" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"issued_by_user_id" text,
	"issued_from" text NOT NULL,
	"issued_to_surface" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"code_expires_at" timestamp DEFAULT now() NOT NULL,
	"token_expires_at" timestamp DEFAULT now() NOT NULL,
	"consumed_at" timestamp DEFAULT now() NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."channel_binding" (
	"id" text PRIMARY KEY,
	"channel_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_channel_id" text NOT NULL,
	"namespace" text,
	"delivery_endpoint_id" text,
	"source" text NOT NULL,
	"assurance" text NOT NULL,
	"established_by_grant_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_by_binding_id" text,
	"revoked_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."claim_session" (
	"id" text PRIMARY KEY,
	"initiated_from" text NOT NULL,
	"purpose" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"anonymous_user_id" text,
	"observed_user_platform" text,
	"observed_user_id" text,
	"observed_user_namespace" text,
	"observed_channel_platform" text,
	"observed_channel_id" text,
	"observed_channel_namespace" text,
	"grant_id" text,
	"status" text NOT NULL,
	"resolved_user_id" text,
	"resolved_channel_id" text,
	"resolution" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."compensation_case" (
	"id" text PRIMARY KEY,
	"case_type" text NOT NULL,
	"status" text NOT NULL,
	"opened_by_user_id" text,
	"related_user_binding_id" text,
	"related_channel_binding_id" text,
	"target_user_id" text,
	"target_channel_id" text,
	"reason" text,
	"resolution" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."user_binding" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_user_id" text NOT NULL,
	"namespace" text,
	"source" text NOT NULL,
	"assurance" text NOT NULL,
	"established_by_grant_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_by_binding_id" text,
	"revoked_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."connection" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"proxy_instance_id" text,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_account_name" text,
	"provider_account_avatar" text,
	"access_mode" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."bot_plugin_instance" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"platform" text NOT NULL,
	"namespace" text,
	"instance_key" text NOT NULL,
	"display_name" text,
	"callback_mode" text DEFAULT 'internal-sse' NOT NULL,
	"delivery_endpoint_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"capabilities" jsonb,
	"metadata" jsonb,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."proxy_instance" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"provider" text NOT NULL,
	"name" text,
	"base_url" text NOT NULL,
	"credential_ref" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"health_status" text DEFAULT 'healthy' NOT NULL,
	"capabilities" jsonb,
	"metadata" jsonb,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."delivery_endpoint" (
	"id" text PRIMARY KEY,
	"owner_user_id" text,
	"platform" text NOT NULL,
	"kind" text NOT NULL,
	"display_name" text,
	"target" text NOT NULL,
	"secret" text,
	"status" text DEFAULT 'active' NOT NULL,
	"config" jsonb,
	"metadata" jsonb,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."notification_event" (
	"id" text PRIMARY KEY,
	"subscription_id" text,
	"channel_id" text NOT NULL,
	"delivery_endpoint_id" text,
	"channel_binding_id" text,
	"title" text,
	"body" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."subscription" (
	"id" text PRIMARY KEY,
	"channel_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"topic_type" text NOT NULL,
	"topic_key" text NOT NULL,
	"event_types" text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"filter_expr" jsonb,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."account_profile" (
	"steam_id" text PRIMARY KEY,
	"connection_id" text NOT NULL,
	"persona_name" text,
	"avatar_url" text,
	"profile_url" text,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."app_catalog" (
	"app_id" bigint PRIMARY KEY,
	"name" text,
	"image_url" text,
	"header_image_url" text,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."family" (
	"id" text PRIMARY KEY,
	"owner_connection_id" text NOT NULL,
	"name" text,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."family_library_item" (
	"id" text PRIMARY KEY,
	"family_id" text NOT NULL,
	"app_id" bigint NOT NULL,
	"owner_steam_ids" text[] NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."family_member" (
	"id" text PRIMARY KEY,
	"family_id" text NOT NULL,
	"steam_id" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam"."user_library_item" (
	"id" text PRIMARY KEY,
	"steam_id" text NOT NULL,
	"app_id" bigint NOT NULL,
	"playtime_minutes" integer,
	"last_played_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_idx" ON "outbox" ("source");--> statement-breakpoint
CREATE INDEX "type_idx" ON "outbox" ("type");--> statement-breakpoint
CREATE INDEX "outbox_polling_idx" ON "outbox" ("status","timestamp") WHERE "status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "outbox_processing_idx" ON "outbox" ("status","processing_at") WHERE "status" = 'PROCESSING';--> statement-breakpoint
CREATE INDEX "idx_trace_span" ON "otel_event_logs" ("trace_id","span_id");--> statement-breakpoint
CREATE INDEX "idx_otel_correlation_id" ON "otel_event_logs" ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_channel_binding_identity" ON "platform"."channel_binding" ("platform","external_channel_id","namespace") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_binding_identity" ON "platform"."user_binding" ("platform","external_user_id","namespace") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_connection_identity" ON "platform"."connection" ("owner_user_id","provider","provider_account_id","access_mode") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bot_plugin_instance_identity" ON "platform"."bot_plugin_instance" ("owner_user_id","platform","namespace","instance_key") WHERE "status" = 'active';--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;