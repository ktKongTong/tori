ALTER TABLE "platform"."user_profile" RENAME COLUMN "display_name" TO "name";--> statement-breakpoint
ALTER TABLE "platform"."bot_plugin_instance" RENAME COLUMN "display_name" TO "name";--> statement-breakpoint
ALTER TABLE "platform"."delivery_endpoint" RENAME COLUMN "display_name" TO "name";--> statement-breakpoint
ALTER INDEX "platform"."uq_mock_bot_singleton" RENAME TO "uq_playground_bot_singleton";--> statement-breakpoint
ALTER TABLE "platform"."bot_plugin_instance" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
DROP INDEX "platform"."uq_playground_bot_singleton";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_playground_bot_singleton" ON "platform"."bot_plugin_instance" ("platform") WHERE "platform" = 'playground' and "deleted_at" IS NULL;