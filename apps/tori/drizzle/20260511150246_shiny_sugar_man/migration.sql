ALTER TABLE "platform"."channel_binding" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "platform"."subscription" DROP COLUMN "bot_plugin_instance_id";