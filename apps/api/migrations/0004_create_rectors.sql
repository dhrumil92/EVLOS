CREATE TABLE "rector_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"rector_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rectors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "rectors_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "rector_sessions" ADD CONSTRAINT "rector_sessions_rector_id_rectors_id_fk" FOREIGN KEY ("rector_id") REFERENCES "public"."rectors"("id") ON DELETE no action ON UPDATE no action;