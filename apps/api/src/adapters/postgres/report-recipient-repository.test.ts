import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresReportRecipientRepository } from './report-recipient-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const pool = new pg.Pool({ connectionString: testUrl });
const repository = new PostgresReportRecipientRepository(drizzle(pool));

const AT = Date.UTC(2026, 10, 5, 6, 0);
const LATER = Date.UTC(2026, 10, 5, 7, 0);
const RECTOR = 'rector@example.com';

const auditRows = async () =>
  (
    await pool.query<{ action: string; detail: string; doneBy: string; doneAt: Date }>(
      'select action, detail, done_by as "doneBy", done_at as "doneAt" from audit_log order by id',
    )
  ).rows;

describe('PostgresReportRecipientRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists the Report Recipients in the order they were added', async () => {
    await repository.add('office@example.com', AT, RECTOR);
    await repository.add('rector@example.com', LATER, RECTOR);

    expect(await repository.list()).toEqual(['office@example.com', 'rector@example.com']);
  });

  it('adds an address once, and says so the second time', async () => {
    const first = await repository.add('office@example.com', AT, RECTOR);
    const second = await repository.add('office@example.com', LATER, RECTOR);

    expect([first, second]).toEqual([true, false]);
    expect(await repository.list()).toEqual(['office@example.com']);
  });

  it('writes the address and the Rector to the audit log when one is added', async () => {
    await repository.add('office@example.com', AT, RECTOR);

    expect(await auditRows()).toEqual([
      {
        action: 'Add Report Recipient',
        detail: 'office@example.com',
        doneBy: RECTOR,
        doneAt: new Date(AT),
      },
    ]);
  });

  it('removes an address and writes it to the audit log', async () => {
    await repository.add('office@example.com', AT, RECTOR);

    const removed = await repository.remove('office@example.com', LATER, RECTOR);

    expect(removed).toBe(true);
    expect(await repository.list()).toEqual([]);
    expect((await auditRows())[1]).toEqual({
      action: 'Remove Report Recipient',
      detail: 'office@example.com',
      doneBy: RECTOR,
      doneAt: new Date(LATER),
    });
  });

  it('removes nothing and writes no audit row for an address not on the list', async () => {
    const removed = await repository.remove('office@example.com', AT, RECTOR);

    expect(removed).toBe(false);
    expect(await auditRows()).toEqual([]);
  });
});
