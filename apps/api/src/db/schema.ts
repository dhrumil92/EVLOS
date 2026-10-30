import { pgTable, text } from 'drizzle-orm/pg-core';

// Registered Devices. An upload from a Device Serial not listed here is refused (FR-2).
export const devices = pgTable('devices', {
  deviceSerial: text('device_serial').primaryKey(),
  label: text('label').notNull(),
});
