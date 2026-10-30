import pg from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from './migrate.js';
import { resetTestDatabase } from './reset-test-database.js';
import { assertTestDatabase } from './test-database.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

async function tableExists(url: string, table: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      'select exists (select 1 from information_schema.tables ' +
        'where table_schema = $1 and table_name = $2) as exists',
      ['public', table],
    );
    return result.rows[0]?.exists === true;
  } finally {
    await client.end();
  }
}

describe('migrateDatabase', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
  });

  it('creates the devices table in an empty test database', async () => {
    await migrateDatabase(testUrl);

    const exists = await tableExists(testUrl, 'devices');

    expect(exists).toBe(true);
  });

  it('changes nothing when run a second time', async () => {
    await migrateDatabase(testUrl);

    const secondRun = migrateDatabase(testUrl);

    await expect(secondRun).resolves.toBeUndefined();
    expect(await tableExists(testUrl, 'devices')).toBe(true);
  });
});
