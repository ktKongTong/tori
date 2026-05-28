ALTER TABLE "request_logs" ADD COLUMN "headers" jsonb;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "query" jsonb;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "request_body" jsonb;