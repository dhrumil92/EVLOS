import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresDeviceRegistry } from './device-registry.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const pool = new pg.Pool({ connectionString: testUrl });
const registry = new PostgresDeviceRegistry(drizzle(pool));

describe('PostgresDeviceRegistry', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
    await pool.query('insert into devices (device_serial, label) values ($1, $2)', [
      'TEST-DEVICE',
      'Test Device',
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('knows a registered Device Serial', async () => {
    expect(await registry.isRegistered('TEST-DEVICE')).toBe(true);
  });

  it('does not know any other Device Serial', async () => {
    expect(await registry.isRegistered('UNREGISTERED')).toBe(false);
  });

  it('treats a quote in a Device Serial as plain text', async () => {
    expect(await registry.isRegistered("' or '1'='1")).toBe(false);
  });
});
