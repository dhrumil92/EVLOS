import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

// Registered Devices. An upload from a Device Serial not listed here is refused (FR-2).
export const devices = pgTable('devices', {
  deviceSerial: text('device_serial').primaryKey(),
  label: text('label').notNull(),
});

// Punches are facts and are never edited. The unique key makes a re-upload harmless.
// student_id has no foreign key: Punches from unknown Student IDs are kept but not counted.
export const punches = pgTable(
  'punches',
  {
    deviceSerial: text('device_serial')
      .notNull()
      .references(() => devices.deviceSerial),
    studentId: text('student_id').notNull(),
    punchedAt: timestamp('punched_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.deviceSerial, table.studentId, table.punchedAt)],
);
