ALTER TABLE "platform"."channel_binding" ADD COLUMN "bot_plugin_instance_id" text;
--> statement-breakpoint
ALTER TABLE "platform"."notification_event" ADD COLUMN "bot_plugin_instance_id" text;
--> statement-breakpoint
ALTER TABLE "platform"."subscription" ADD COLUMN "bot_plugin_instance_id" text;
--> statement-breakpoint

UPDATE "platform"."channel_binding" AS cb
SET "bot_plugin_instance_id" = bpi."id"
FROM "platform"."bot_plugin_instance" AS bpi
WHERE cb."bot_plugin_instance_id" IS NULL
  AND cb."delivery_endpoint_id" IS NOT NULL
  AND bpi."delivery_endpoint_id" = cb."delivery_endpoint_id";
--> statement-breakpoint

UPDATE "platform"."subscription" AS s
SET "bot_plugin_instance_id" = cb."bot_plugin_instance_id"
FROM "platform"."channel_binding" AS cb
WHERE s."bot_plugin_instance_id" IS NULL
  AND cb."channel_id" = s."channel_id"
  AND cb."status" = 'active'
  AND cb."bot_plugin_instance_id" IS NOT NULL;
--> statement-breakpoint

UPDATE "platform"."notification_event" AS ne
SET "bot_plugin_instance_id" = s."bot_plugin_instance_id"
FROM "platform"."subscription" AS s
WHERE ne."bot_plugin_instance_id" IS NULL
  AND ne."subscription_id" = s."id"
  AND s."bot_plugin_instance_id" IS NOT NULL;
--> statement-breakpoint

UPDATE "platform"."notification_event" AS ne
SET "bot_plugin_instance_id" = bpi."id"
FROM "platform"."bot_plugin_instance" AS bpi
WHERE ne."bot_plugin_instance_id" IS NULL
  AND ne."delivery_endpoint_id" IS NOT NULL
  AND bpi."delivery_endpoint_id" = ne."delivery_endpoint_id";
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "platform"."subscription"
    WHERE "bot_plugin_instance_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill platform.subscription.bot_plugin_instance_id for all rows';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "platform"."subscription" ALTER COLUMN "bot_plugin_instance_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform"."channel_binding" DROP COLUMN "delivery_endpoint_id";
