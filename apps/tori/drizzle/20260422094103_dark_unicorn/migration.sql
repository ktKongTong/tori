ALTER TABLE "platform"."channel_binding" ADD COLUMN "external_channel_name" text;--> statement-breakpoint
ALTER TABLE "platform"."claim_session" ADD COLUMN "anonymous_user_name" text;--> statement-breakpoint
ALTER TABLE "platform"."claim_session" ADD COLUMN "observed_user_name" text;--> statement-breakpoint
ALTER TABLE "platform"."claim_session" ADD COLUMN "observed_channel_name" text;--> statement-breakpoint
ALTER TABLE "platform"."user_binding" ADD COLUMN "external_user_name" text;