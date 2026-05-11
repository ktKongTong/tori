ALTER TABLE "task"."definition" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."channel_binding" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."user_binding" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."connection_credential" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."connection" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."channel" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."bot_plugin_instance" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."proxy_instance" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."delivery_endpoint" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform"."subscription" ADD COLUMN "deleted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "auth"."user" ALTER COLUMN "claimed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task"."definition" ALTER COLUMN "last_triggered_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task"."definition" ALTER COLUMN "last_run_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task"."run" ALTER COLUMN "scheduled_for" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task"."run" ALTER COLUMN "started_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task"."run" ALTER COLUMN "finished_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."binding_grant" ALTER COLUMN "consumed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."channel_binding" ALTER COLUMN "ended_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."claim_session" ALTER COLUMN "resolved_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."compensation_case" ALTER COLUMN "closed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."user_binding" ALTER COLUMN "ended_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."connection" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."bot_plugin_instance" ALTER COLUMN "last_seen_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."proxy_instance" ALTER COLUMN "last_seen_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."delivery_endpoint" ALTER COLUMN "last_used_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."notification_event" ALTER COLUMN "sent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."notification_event" ALTER COLUMN "failed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."account_profile" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family_library_item" ALTER COLUMN "acquired_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family_library_item" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family_member" ALTER COLUMN "joined_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family_member" ALTER COLUMN "left_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."family_member" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."user_library_item" ALTER COLUMN "last_played_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "steam"."user_library_item" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_channel_binding_identity";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_channel_binding_identity" ON "platform"."channel_binding" ("platform","external_channel_id","namespace") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_user_binding_identity";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_binding_identity" ON "platform"."user_binding" ("platform","external_user_id","namespace") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_active_connection_credential";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_connection_credential" ON "platform"."connection_credential" ("connection_id","kind") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_connection_identity";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_connection_identity" ON "platform"."connection" ("owner_user_id","provider","provider_account_id","access_mode") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_bot_plugin_instance_identity";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bot_plugin_instance_identity" ON "platform"."bot_plugin_instance" ("owner_user_id","platform","namespace","instance_key") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_mock_bot_singleton";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mock_bot_singleton" ON "platform"."bot_plugin_instance" ("platform") WHERE "platform" = 'mock' and "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_delivery_endpoint_target";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_delivery_endpoint_target" ON "platform"."delivery_endpoint" ("platform","kind","target") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_proxy_instance_base_url" ON "platform"."proxy_instance" ("owner_user_id","base_url") WHERE "deleted_at" IS NULL;