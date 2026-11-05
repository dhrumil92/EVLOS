CREATE TABLE "outbox_attachments" (
	"outbox_email_id" integer NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content" "bytea" NOT NULL,
	CONSTRAINT "outbox_attachments_outbox_email_id_position_pk" PRIMARY KEY("outbox_email_id","position")
);
--> statement-breakpoint
ALTER TABLE "outbox_attachments" ADD CONSTRAINT "outbox_attachments_outbox_email_id_outbox_emails_id_fk" FOREIGN KEY ("outbox_email_id") REFERENCES "public"."outbox_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Move each existing attachment (a CSV, kept as text) into the new table before its columns go.
INSERT INTO "outbox_attachments" ("outbox_email_id", "position", "file_name", "content")
SELECT "id", 0, "attachment_name", convert_to("attachment", 'UTF8')
FROM "outbox_emails"
WHERE "attachment_name" IS NOT NULL AND "attachment" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_emails" DROP COLUMN "attachment_name";--> statement-breakpoint
ALTER TABLE "outbox_emails" DROP COLUMN "attachment";