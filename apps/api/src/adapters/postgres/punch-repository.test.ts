import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import type { ReceivedPunch } from '../../ports/punch-repository.js';
import { PostgresPunchRepository } from './punch-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const DEVICE_SERIAL = 'TEST-DEVICE';
const AT_0700_IST = Date.UTC(2026, 10, 10, 1, 30, 0);
const AT_0701_IST = Date.UTC(2026, 10, 10, 1, 31, 0);

const pool = new pg.Pool({ connectionString: testUrl });
const repository = new PostgresPunchRepository(drizzle(pool));

const punch = (facts: Partial<ReceivedPunch> = {}): ReceivedPunch => ({
  deviceSerial: DEVICE_SERIAL,
  studentId: '9001',
  punchedAt: AT_0700_IST,
  receivedAt: AT_0701_IST,
  ...facts,
});

async function storedPunches(): Promise<{ student_id: string; punched_at: Date }[]> {
  const result = await pool.query<{ student_id: string; punched_at: Date }>(
    'select student_id, punched_at from punches order by punched_at',
  );
  return result.rows;
}

describe('PostgresPunchRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
    await pool.query('insert into devices (device_serial, label) values ($1, $2)', [
      DEVICE_SERIAL,
      'Test Device',
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores a Punch at its exact instant', async () => {
    const stored = await repository.record(punch());

    const rows = await storedPunches();
    expect(stored).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.student_id).toBe('9001');
    expect(rows[0]?.punched_at.getTime()).toBe(AT_0700_IST);
  });

  it('stores the same Punch uploaded twice only once', async () => {
    await repository.record(punch());

    const storedAgain = await repository.record(punch({ receivedAt: AT_0701_IST + 60_000 }));

    expect(storedAgain).toBe(false);
    expect(await storedPunches()).toHaveLength(1);
  });

  it('stores two Punches of one Student at different times', async () => {
    await repository.record(punch());

    await repository.record(punch({ punchedAt: AT_0701_IST }));

    expect(await storedPunches()).toHaveLength(2);
  });

  it('stores a Punch for a Student ID that is unknown', async () => {
    const stored = await repository.record(punch({ studentId: 'not-a-known-student' }));

    expect(stored).toBe(true);
  });

  it('keeps leading zeros in a Student ID', async () => {
    await repository.record(punch({ studentId: '0042' }));

    const rows = await storedPunches();
    expect(rows[0]?.student_id).toBe('0042');
  });

  it('finds the Punches of a Day from 00:00:00 IST to 23:59:59 IST, newest first', async () => {
    const firstSecondOfDay = Date.UTC(2026, 10, 9, 18, 30, 0);
    const lastSecondOfDay = Date.UTC(2026, 10, 10, 18, 29, 59);
    await repository.record(punch({ punchedAt: firstSecondOfDay }));
    await repository.record(punch({ punchedAt: lastSecondOfDay }));

    const punches = await repository.punchesOn('2026-11-10');

    expect(punches).toEqual([
      { studentId: '9001', punchedAt: lastSecondOfDay },
      { studentId: '9001', punchedAt: firstSecondOfDay },
    ]);
  });

  it('leaves out the Punches of the Days either side', async () => {
    await repository.record(punch({ punchedAt: Date.UTC(2026, 10, 9, 18, 29, 59) }));
    await repository.record(punch({ punchedAt: Date.UTC(2026, 10, 10, 18, 30, 0) }));

    expect(await repository.punchesOn('2026-11-10')).toEqual([]);
  });

  it('refuses a Punch from a Device Serial that is not registered', async () => {
    const recording = repository.record(punch({ deviceSerial: 'UNREGISTERED' }));

    await expect(recording).rejects.toThrow();
    expect(await storedPunches()).toHaveLength(0);
  });

  it('gives every Punch from the first Day to the last, in IST Days, oldest first', async () => {
    const ist = (date: number, hour: number) =>
      Date.UTC(2026, 10, date, hour) - 5.5 * 60 * 60 * 1000;
    for (const punchedAt of [ist(9, 23), ist(10, 0), ist(11, 12), ist(12, 0)]) {
      await repository.record(punch({ punchedAt }));
    }

    const between = await repository.punchesBetween('2026-11-10', '2026-11-11');

    expect(between.map((one) => one.punchedAt)).toEqual([ist(10, 0), ist(11, 12)]);
  });

  it('gives the Punches of a Day that arrived after a moment, oldest first', async () => {
    const ist = (date: number, hour: number, minute = 0) =>
      Date.UTC(2026, 10, date, hour, minute) - 5.5 * 60 * 60 * 1000;
    const finalizedAt = ist(10, 23);
    await repository.record(
      punch({ studentId: '9001', punchedAt: ist(10, 7), receivedAt: ist(10, 7) }),
    );
    await repository.record(
      punch({ studentId: '9002', punchedAt: ist(10, 8), receivedAt: ist(10, 23, 10) }),
    );
    await repository.record(
      punch({ studentId: '9003', punchedAt: ist(10, 6), receivedAt: ist(10, 23, 20) }),
    );
    await repository.record(
      punch({ studentId: '9004', punchedAt: ist(11, 6), receivedAt: ist(11, 6, 5) }),
    );

    const arrived = await repository.punchesReceivedAfter('2026-11-10', finalizedAt);

    expect(arrived).toEqual([
      { studentId: '9003', punchedAt: ist(10, 6) },
      { studentId: '9002', punchedAt: ist(10, 8) },
    ]);
  });
});
