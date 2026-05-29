CREATE TABLE `oauth_clients` (
	`client_id` text PRIMARY KEY,
	`client_secret` text NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`scopes` text NOT NULL,
	`policy_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proxy_grants` (
	`id` text PRIMARY KEY,
	`token_hash` text NOT NULL CONSTRAINT `proxy_grants_token_hash_unique` UNIQUE,
	`client_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `proxy_policies` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`document` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `request_logs` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `headers` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `query` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `request_body` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `policy_id` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `matched_rule_id` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `rule_decision` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `blocked_reason` text;--> statement-breakpoint
DROP TABLE `proxy_rules`;