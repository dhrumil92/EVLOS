import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresLeaveRepository } from './leave-repository.js';
import { PostgresStudentRepository } from './student-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const pool = new pg.Pool({ connectionString: testUrl });
const db = drizzle(pool);
const repository = new PostgresLeaveRepository(db);
const students = new PostgresStudentRepository(db);

const OUT = Date.UTC(2026, 10, 1, 3, 0, 0);
const EXPECTED = Date.UTC(2026, 10, 5, 12, 0, 0);
const RETURNED = Date.UTC(2026, 10, 4, 13, 0, 0);
const AT = Date.UTC(2026, 10, 4, 17, 0, 0);
const RECTOR = 'rector@example.com';
const TIMES = { outAt: OUT, expectedReturnAt: EXPECTED };

const audit = async () =>
  (
    await pool.query<{ action: string; studentId: string; doneBy: string }>(
      'select action, student_id as "studentId", done_by as "doneBy" from audit_log order by id',
    )
  ).rows;

async function recordOne() {
  await repository.record('9001', TIMES, AT, RECTOR);
  const [leave] = await repository.leavesOf('9001');
  if (!leave) throw new Error('The Leave was not saved.');
  return leave;
}

describe('PostgresLeaveRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
    for (const studentId of ['9001', '9002']) {
      await students.add(
        { studentId, name: 'Test', room: '101', email: 'a@example.com', phone: null },
        '2026-11-01',
      );
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('keeps a recorded Leave open, with its Out Time and Expected Return', async () => {
    const leave = await recordOne();

    expect(leave).toMatchObject({ studentId: '9001', ...TIMES, returnedAt: null });
  });

  it('records a Leave in the audit log with the Rector', async () => {
    await recordOne();

    expect(await audit()).toEqual([{ action: 'Leave', studentId: '9001', doneBy: RECTOR }]);
  });

  it('lists only the open Leaves for the Student list', async () => {
    const closed = await recordOne();
    await repository.recordReturn(closed, RETURNED, AT, RECTOR);
    await repository.record('9002', TIMES, AT, RECTOR);

    expect((await repository.openLeaves()).map((leave) => leave.studentId)).toEqual(['9002']);
  });

  it('saves edited times and records the edit', async () => {
    const leave = await recordOne();

    await repository.edit(leave, { outAt: OUT, expectedReturnAt: EXPECTED + 1000 }, AT, RECTOR);

    expect((await repository.leavesOf('9001'))[0]?.expectedReturnAt).toBe(EXPECTED + 1000);
    expect((await audit()).map((entry) => entry.action)).toEqual(['Leave', 'Edit Leave']);
  });

  it('keeps a cancelled Leave in the table but leaves it out from then on', async () => {
    const leave = await recordOne();

    await repository.cancel(leave, AT, RECTOR);

    expect(await repository.leavesOf('9001')).toEqual([]);
    expect(await repository.openLeaves()).toEqual([]);
    expect((await pool.query('select 1 from leaves')).rowCount).toBe(1);
    expect((await audit()).map((entry) => entry.action)).toEqual(['Leave', 'Cancel Leave']);
  });

  it('closes the Leave with the Return Time and keeps the Expected Return', async () => {
    const leave = await recordOne();

    await repository.recordReturn(leave, RETURNED, AT, RECTOR);

    expect((await repository.leavesOf('9001'))[0]).toMatchObject({
      expectedReturnAt: EXPECTED,
      returnedAt: RETURNED,
    });
    expect((await audit()).map((entry) => entry.action)).toEqual(['Leave', 'Return']);
  });

  it('lists a Student’s Leaves oldest first', async () => {
    const first = await recordOne();
    await repository.recordReturn(first, RETURNED, AT, RECTOR);
    await repository.record('9001', { outAt: AT, expectedReturnAt: AT }, AT, RECTOR);

    expect((await repository.leavesOf('9001')).map((leave) => leave.outAt)).toEqual([OUT, AT]);
  });

  it('gives the Leaves that overlap a time span, open ones included', async () => {
    const closed = await recordOne();
    await repository.recordReturn(closed, RETURNED, AT, RECTOR);
    await repository.record('9002', { outAt: AT, expectedReturnAt: AT }, AT, RECTOR);

    const before = await repository.leavesBetween(OUT - 2000, OUT - 1000);
    const during = await repository.leavesBetween(RETURNED - 1000, RETURNED);
    const later = await repository.leavesBetween(AT + 1000, AT + 2000);

    expect(before).toEqual([]);
    expect(during.map((leave) => leave.studentId)).toEqual(['9001']);
    expect(later.map((leave) => leave.studentId)).toEqual(['9002']);
  });

  it('leaves out a cancelled Leave when asked for a time span', async () => {
    const leave = await recordOne();
    await repository.cancel(leave, AT, RECTOR);

    expect(await repository.leavesBetween(OUT, AT)).toEqual([]);
  });
});
