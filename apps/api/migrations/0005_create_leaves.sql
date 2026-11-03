CREATE TABLE "leaves" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leaves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" text NOT NULL,
	"out_at" timestamp with time zone NOT NULL,
	"expected_return_at" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;