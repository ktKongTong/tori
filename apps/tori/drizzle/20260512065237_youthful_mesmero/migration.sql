ALTER TABLE "platform"."user_binding" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "platform"."user_binding" DROP COLUMN "superseded_by_binding_id";--> statement-breakpoint
ALTER TABLE "platform"."user_binding" DROP COLUMN "revoked_reason";--> statement-breakpoint
ALTER TABLE "platform"."user_binding" DROP COLUMN "ended_at";