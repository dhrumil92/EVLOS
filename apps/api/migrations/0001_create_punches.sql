CREATE TABLE "punches" (
	"device_serial" text NOT NULL,
	"student_id" text NOT NULL,
	"punched_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	CONSTRAINT "punches_device_serial_student_id_punched_at_unique" UNIQUE("device_serial","student_id","punched_at")
);
--> statement-breakpoint
ALTER TABLE "punches" ADD CONSTRAINT "punches_device_serial_devices_device_serial_fk" FOREIGN KEY ("device_serial") REFERENCES "public"."devices"("device_serial") ON DELETE no action ON UPDATE no action;