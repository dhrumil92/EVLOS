import type { Student } from '@evlos/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresStudentRepository } from './student-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const TODAY = '2026-11-03';
const pool = new pg.Pool({ connectionString: testUrl });
const repository = new PostgresStudentRepository(drizzle(pool));

const student = (facts: Partial<Student> = {}): Student => ({
  studentId: '9001',
  name: 'Test Student',
  room: '101',
  email: 'test.student@example.com',
  phone: null,
  ...facts,
});

describe('PostgresStudentRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores a Student and lists him', async () => {
    const added = await repository.add(student({ phone: '9800000000' }), TODAY);

    expect(added).toBe(true);
    expect(await repository.list()).toEqual([student({ phone: '9800000000' })]);
  });

  it('keeps a missing phone as no phone', async () => {
    await repository.add(student(), TODAY);

    const [listed] = await repository.list();

    expect(listed?.phone).toBeNull();
  });

  it('makes a new Student Active from the given Day', async () => {
    await repository.add(student(), TODAY);

    const periods = await pool.query<{ from: string; until: string | null }>(
      'select active_from::text as "from", active_until::text as "until" ' +
        'from student_active_periods where student_id = $1',
      ['9001'],
    );

    expect(periods.rows).toEqual([{ from: TODAY, until: null }]);
  });

  it('refuses a Student ID that is already used and changes nothing', async () => {
    await repository.add(student(), TODAY);

    const added = await repository.add(student({ name: 'Someone Else' }), TODAY);

    expect(added).toBe(false);
    expect((await repository.list()).map((one) => one.name)).toEqual(['Test Student']);
  });

  it('adds no second Active period for a refused Student ID', async () => {
    await repository.add(student(), '2026-11-01');

    await repository.add(student(), TODAY);

    const periods = await pool.query('select 1 from student_active_periods');
    expect(periods.rowCount).toBe(1);
  });

  it('keeps leading zeros in a Student ID', async () => {
    await repository.add(student({ studentId: '0042' }), TODAY);

    const [listed] = await repository.list();

    expect(listed?.studentId).toBe('0042');
  });

  it('adds many Students at once, each Active from the given Day', async () => {
    await repository.addMany([student(), student({ studentId: '9002' })], TODAY);

    expect((await repository.list()).map((one) => one.studentId)).toEqual(['9001', '9002']);
    expect((await repository.activePeriods()).map((one) => one.activeFrom)).toEqual([TODAY, TODAY]);
  });

  it('adds none of many Students when one Student ID is already used', async () => {
    await repository.add(student({ studentId: '9002' }), TODAY);

    await expect(
      repository.addMany([student(), student({ studentId: '9002', name: 'Other' })], TODAY),
    ).rejects.toThrow();

    expect((await repository.list()).map((one) => one.studentId)).toEqual(['9002']);
  });

  it('lists every Active period with its Student ID', async () => {
    await repository.add(student(), '2026-11-01');

    expect(await repository.activePeriods()).toEqual([
      { studentId: '9001', activeFrom: '2026-11-01', activeUntil: null },
    ]);
  });

  describe('editing', () => {
    it('saves new details for the same Student ID', async () => {
      await repository.add(student(), TODAY);

      const updated = await repository.update(student({ name: 'New Name', phone: '98' }));

      expect(updated).toBe(true);
      expect(await repository.list()).toEqual([student({ name: 'New Name', phone: '98' })]);
    });

    it('changes no other Student', async () => {
      await repository.add(student(), TODAY);
      await repository.add(student({ studentId: '9002', name: 'Other' }), TODAY);

      await repository.update(student({ name: 'New Name' }));

      expect((await repository.list()).map((one) => one.name)).toEqual(['New Name', 'Other']);
    });

    it('reports an unknown Student ID and adds no Student', async () => {
      const updated = await repository.update(student());

      expect(updated).toBe(false);
      expect(await repository.list()).toEqual([]);
    });
  });

  describe('Deactivate and Activate', () => {
    const AT = Date.UTC(2026, 10, 3, 5, 0, 0);
    const audit = () =>
      pool.query<{ action: string; studentId: string; doneAt: Date; doneBy: string | null }>(
        'select action, student_id as "studentId", done_at as "doneAt", done_by as "doneBy" ' +
          'from audit_log order by id',
      );

    it('ends his open Active period on the Day he is Deactivated', async () => {
      await repository.add(student(), '2026-11-01');

      await repository.deactivate('9001', TODAY, AT, 'rector@example.com');

      expect(await repository.activePeriods()).toEqual([
        { studentId: '9001', activeFrom: '2026-11-01', activeUntil: TODAY },
      ]);
    });

    it('starts a new Active period when he is Activated on a later Day', async () => {
      await repository.add(student(), '2026-11-01');
      await repository.deactivate('9001', '2026-11-02', AT, 'rector@example.com');

      await repository.activate('9001', TODAY, AT, 'rector@example.com');

      expect(await repository.activePeriods()).toEqual([
        { studentId: '9001', activeFrom: '2026-11-01', activeUntil: '2026-11-02' },
        { studentId: '9001', activeFrom: TODAY, activeUntil: null },
      ]);
    });

    it('reopens his period when he is Activated on the Day he was Deactivated', async () => {
      await repository.add(student(), '2026-11-01');
      await repository.deactivate('9001', TODAY, AT, 'rector@example.com');

      await repository.activate('9001', TODAY, AT, 'rector@example.com');

      expect(await repository.activePeriods()).toEqual([
        { studentId: '9001', activeFrom: '2026-11-01', activeUntil: null },
      ]);
    });

    it('records Deactivate and Activate in the audit log with the time and the Rector', async () => {
      await repository.add(student(), '2026-11-01');

      await repository.deactivate('9001', TODAY, AT, 'rector@example.com');
      await repository.activate('9001', TODAY, AT + 1000, 'rector@example.com');

      expect((await audit()).rows).toEqual([
        {
          action: 'Deactivate',
          studentId: '9001',
          doneAt: new Date(AT),
          doneBy: 'rector@example.com',
        },
        {
          action: 'Activate',
          studentId: '9001',
          doneAt: new Date(AT + 1000),
          doneBy: 'rector@example.com',
        },
      ]);
    });
  });
});
