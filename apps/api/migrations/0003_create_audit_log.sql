CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"action" text NOT NULL,
	"student_id" text,
	"done_at" timestamp with time zone NOT NULL,
	"done_by" text
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;