ALTER TABLE "task"."definition"
    ALTER COLUMN "enabled" DROP DEFAULT,
    ALTER COLUMN "enabled" SET DATA TYPE boolean USING "enabled"::boolean;--> statement-breakpoint
ALTER TABLE "task"."definition" ALTER COLUMN "enabled" SET DEFAULT true;