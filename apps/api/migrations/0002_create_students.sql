CREATE TABLE "student_active_periods" (
	"student_id" text NOT NULL,
	"active_from" date NOT NULL,
	"active_until" date,
	CONSTRAINT "student_active_periods_student_id_active_from_pk" PRIMARY KEY("student_id","active_from")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"room" text NOT NULL,
	"email" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
ALTER TABLE "student_active_periods" ADD CONSTRAINT "student_active_periods_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;