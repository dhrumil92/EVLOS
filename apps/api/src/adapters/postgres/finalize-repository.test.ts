import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresFinalizeRepository } from './finalize-repository.js';
import { PostgresStudentRepository } from './student-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const pool = new pg.Pool({ connectionString: testUrl });
const db = drizzle(pool);
const repository = new PostgresFinalizeRepository(db);
const students = new PostgresStudentRepository(db);

const DAY = '2026-11-03';
const AT = Date.UTC(2026, 10, 3, 17, 30);
const PUNCHED = Date.UTC(2026, 10, 3, 1, 30);
const RECTOR = 'rector@example.com';
const RESULTS = [
  { studentId: '9001', status: 'Present' as const, firstPunchAt: PUNCHED },
  { studentId: '9002', status: 'Absent' as const, firstPunchAt: null },
  { studentId: '9003', status: 'Absent' as const, firstPunchAt: null },
];
const notification = (studentId: string) => ({
  studentId,
  recipient: `${studentId}@example.com`,
  subject: 'Pooja missed',
  body: 'You missed Pooja.',
});

const audit = async () =>
  (await pool.query<{ action: string }>('select action from audit_log order by id')).rows.map(
    (row) => row.action,
  );
const outbox = async () =>
  (
    await pool.query<{ recipient: string; dedupeKey: string; status: string }>(
      'select recipient, dedupe_key as "dedupeKey", status from outbox_emails order by id',
    )
  ).rows;

describe('PostgresFinalizeRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
    for (const studentId of ['9001', '9002', '9003']) {
      await students.add(
        { studentId, name: 'Test', room: '101', email: `${studentId}@example.com`, phone: null },
        '2026-11-01',
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('locks the Day with who Finalized it and when', async () => {
    const done = await repository.finalize(DAY, RESULTS, AT, RECTOR);

    expect(done).toBe(true);
    expect(await repository.finalizationsBetween(DAY, DAY)).toEqual([
      { day: DAY, finalizedBy: RECTOR, finalizedAt: AT },
    ]);
    expect(await audit()).toEqual(['Finalize']);
  });

  it('saves every Pooja Status of the Day', async () => {
    await repository.finalize(DAY, RESULTS, AT, RECTOR);

    expect(await repository.resultsBetween(DAY, DAY)).toEqual(
      RESULTS.map((result) => ({ ...result, day: DAY, excludedAt: null })),
    );
  });

  it('refuses a second Finalize and changes nothing', async () => {
    await repository.finalize(DAY, RESULTS, AT, RECTOR);

    const again = await repository.finalize(DAY, [], AT + 1000, 'someone@example.com');

    expect(again).toBe(false);
    expect(await repository.resultsBetween(DAY, DAY)).toHaveLength(3);
    expect(await audit()).toEqual(['Finalize']);
  });

  it('queues one Notification per Student and saves the Exclusions', async () => {
    await repository.finalize(DAY, RESULTS, AT, RECTOR);

    const queued = await repository.sendNotifications(
      DAY,
      ['9003'],
      [notification('9002')],
      AT,
      RECTOR,
    );

    expect(queued).toBe(1);
    expect(await outbox()).toEqual([
      { recipient: '9002@example.com', dedupeKey: `Notification|${DAY}|9002`, status: 'queued' },
    ]);
    const excluded = (await repository.resultsBetween(DAY, DAY)).filter(
      (r) => r.excludedAt !== null,
    );
    expect(excluded.map((result) => result.studentId)).toEqual(['9003']);
    expect(await audit()).toEqual(['Finalize', 'Exclude', 'Send Notifications']);
    expect(await repository.notifiedStudentIds(DAY)).toEqual(['9002']);
  });

  it('never queues a second Notification for the same Day and Student', async () => {
    await repository.finalize(DAY, RESULTS, AT, RECTOR);
    await repository.sendNotifications(DAY, [], [notification('9002')], AT, RECTOR);

    const again = await repository.sendNotifications(DAY, [], [notification('9002')], AT, RECTOR);

    expect(again).toBe(0);
    expect(await outbox()).toHaveLength(1);
  });

  it('records an Exclude once, keeping the first time, when it is sent again', async () => {
    await repository.finalize(DAY, RESULTS, AT, RECTOR);
    await repository.sendNotifications(DAY, ['9003'], [], AT, RECTOR);

    await repository.sendNotifications(DAY, ['9003'], [], AT + 1000, RECTOR);

    const [excluded] = (await repository.resultsBetween(DAY, DAY)).filter((r) => r.excludedAt);
    expect(excluded?.excludedAt).toBe(AT);
    expect((await audit()).filter((action) => action === 'Exclude')).toHaveLength(1);
  });
});
