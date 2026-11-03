CREATE TABLE "day_finalizations" (
	"day" date PRIMARY KEY NOT NULL,
	"finalized_by" text NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_emails" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_emails_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "outbox_emails_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "pooja_results" (
	"day" date NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"first_punch_at" timestamp with time zone,
	"excluded_at" timestamp with time zone,
	CONSTRAINT "pooja_results_day_student_id_pk" PRIMARY KEY("day","student_id")
);
--> statement-breakpoint
ALTER TABLE "pooja_results" ADD CONSTRAINT "pooja_results_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;