import {
  customType,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// PostgreSQL's column for raw bytes, such as an Excel file. Drizzle has no built-in one.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

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

// Students are never deleted, so a Student ID stays used for ever and is never reused.
export const students = pgTable('students', {
  studentId: text('student_id').primaryKey(),
  name: text('name').notNull(),
  room: text('room').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
});

// One open period while a Student is Active, so Deactivate never rewrites history.
export const studentActivePeriods = pgTable(
  'student_active_periods',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => students.studentId),
    activeFrom: date('active_from').notNull(),
    activeUntil: date('active_until'),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.activeFrom] })],
);

// Leaves (FR-4, FR-5). Expected Return and Return Time are kept apart; a Return never
// overwrites the Expected Return. A cancelled Leave is kept, marked, and then ignored.
export const leaves = pgTable('leaves', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  studentId: text('student_id')
    .notNull()
    .references(() => students.studentId),
  outAt: timestamp('out_at', { withTimezone: true }).notNull(),
  expectedReturnAt: timestamp('expected_return_at', { withTimezone: true }).notNull(),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
});

// A Finalized Day is locked: one row per Day, never removed (FR-8).
export const dayFinalizations = pgTable('day_finalizations', {
  day: date('day').primaryKey(),
  finalizedBy: text('finalized_by').notNull(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull(),
});

// Written at Finalize only, so a Finalized Day never changes when Leaves or Students change
// later. Before Finalize, Pooja Status is worked out on read. excluded_at marks an Exclude.
export const poojaResults = pgTable(
  'pooja_results',
  {
    day: date('day').notNull(),
    studentId: text('student_id')
      .notNull()
      .references(() => students.studentId),
    status: text('status').notNull(),
    firstPunchAt: timestamp('first_punch_at', { withTimezone: true }),
    excludedAt: timestamp('excluded_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.day, table.studentId] })],
);

// Emails waiting to be sent. The unique dedupe_key (kind, Day, Student) means a second
// Send Notifications, or a retry, can never queue a second email (FR-9).
export const outboxEmails = pgTable('outbox_emails', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  kind: text('kind').notNull(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  dedupeKey: text('dedupe_key').notNull().unique(),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  sendAfter: timestamp('send_after', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

// The files sent with an outbox email, such as the Daily Report as Excel and as CSV, in the
// order given by position. Kept as bytes, since an Excel file is not text.
export const outboxAttachments = pgTable(
  'outbox_attachments',
  {
    outboxEmailId: integer('outbox_email_id')
      .notNull()
      .references(() => outboxEmails.id),
    position: integer('position').notNull(),
    fileName: text('file_name').notNull(),
    content: bytea('content').notNull(),
  },
  (table) => [primaryKey({ columns: [table.outboxEmailId, table.position] })],
);

// The Rector's login (FR-13). Only an Argon2 hash of the password is kept.
export const rectors = pgTable('rectors', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});

// One row per login. Only a SHA-256 hash of the cookie token is kept, so a copy of
// this table cannot be used to log in.
export const rectorSessions = pgTable('rector_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  rectorId: integer('rector_id')
    .notNull()
    .references(() => rectors.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Who did what and when (FR-14). Rows are only ever added. done_by stays empty until
// Rector login exists. student_id is empty for actions about a Day, such as Finalize.
export const auditLog = pgTable('audit_log', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  action: text('action').notNull(),
  studentId: text('student_id').references(() => students.studentId),
  doneAt: timestamp('done_at', { withTimezone: true }).notNull(),
  doneBy: text('done_by'),
  // What the action was about when it is not a Student, such as the address of a Report
  // Recipient. Null otherwise.
  detail: text('detail'),
});

// The Report Recipients: the addresses that receive the Review Reminder, Daily Report and
// Monthly Report, kept in lower case. Who added or removed each one is in audit_log.
export const reportRecipients = pgTable('report_recipients', {
  email: text('email').primaryKey(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull(),
});
