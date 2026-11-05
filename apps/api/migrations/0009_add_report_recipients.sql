CREATE TABLE "report_recipients" (
	"email" text PRIMARY KEY NOT NULL,
	"added_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "detail" text;