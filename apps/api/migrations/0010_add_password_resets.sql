CREATE TABLE "password_resets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"rector_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_rector_id_rectors_id_fk" FOREIGN KEY ("rector_id") REFERENCES "public"."rectors"("id") ON DELETE no action ON UPDATE no action;