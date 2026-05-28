CREATE TABLE "oauth_clients" (
	"client_id" text PRIMARY KEY,
	"client_secret" text NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"scopes" jsonb NOT NULL,
	"created_at" integer NOT NULL
);
