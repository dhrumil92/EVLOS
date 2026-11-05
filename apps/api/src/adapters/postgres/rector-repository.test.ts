import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresRectorRepository } from './rector-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const EXPIRES_AT = Date.UTC(2026, 10, 3, 15, 0, 0);
const pool = new pg.Pool({ connectionString: testUrl });
const repository = new PostgresRectorRepository(drizzle(pool));

describe('PostgresRectorRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores a Rector and finds him by email', async () => {
    await repository.add('rector@example.com', 'the-hash');

    expect(await repository.findByEmail('rector@example.com')).toEqual({
      rector: { id: 1, email: 'rector@example.com' },
      passwordHash: 'the-hash',
    });
  });

  it('finds nobody for an unknown email', async () => {
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
  });

  it('refuses a second account for the same email', async () => {
    await repository.add('rector@example.com', 'the-hash');

    expect(await repository.add('rector@example.com', 'other-hash')).toBe(false);
  });

  it('keeps a session with its Rector and expiry', async () => {
    await repository.add('rector@example.com', 'the-hash');

    await repository.addSession('token-hash', 1, EXPIRES_AT);

    expect(await repository.sessionOf('token-hash')).toEqual({
      rector: { id: 1, email: 'rector@example.com' },
      expiresAt: EXPIRES_AT,
    });
  });

  it('forgets a removed session', async () => {
    await repository.add('rector@example.com', 'the-hash');
    await repository.addSession('token-hash', 1, EXPIRES_AT);

    await repository.removeSession('token-hash');

    expect(await repository.sessionOf('token-hash')).toBeNull();
  });

  describe('changePassword', () => {
    const AT = Date.UTC(2026, 10, 5, 8, 0, 0);

    // Rector 1 logged in on two devices; Rector 2 once.
    async function twoRectors() {
      await repository.add('rector@example.com', 'old-hash');
      await repository.add('other@example.com', 'other-hash');
      await repository.addSession('laptop', 1, EXPIRES_AT);
      await repository.addSession('phone', 1, EXPIRES_AT);
      await repository.addSession('other-laptop', 2, EXPIRES_AT);
    }

    it('saves the new password hash', async () => {
      await twoRectors();

      await repository.changePassword(1, 'new-hash', 'laptop', AT, 'rector@example.com');

      expect((await repository.findByEmail('rector@example.com'))?.passwordHash).toBe('new-hash');
      expect((await repository.findByEmail('other@example.com'))?.passwordHash).toBe('other-hash');
    });

    it("ends the Rector's other sessions, keeps this one, and leaves other Rectors alone", async () => {
      await twoRectors();

      await repository.changePassword(1, 'new-hash', 'laptop', AT, 'rector@example.com');

      expect(await repository.sessionOf('laptop')).not.toBeNull();
      expect(await repository.sessionOf('phone')).toBeNull();
      expect(await repository.sessionOf('other-laptop')).not.toBeNull();
    });

    it('writes who changed the password and when to the audit log', async () => {
      await twoRectors();

      await repository.changePassword(1, 'new-hash', 'laptop', AT, 'rector@example.com');

      const { rows } = await pool.query<{ action: string; doneBy: string; doneAt: Date }>(
        'select action, done_by as "doneBy", done_at as "doneAt" from audit_log',
      );
      expect(rows).toEqual([
        { action: 'Change Password', doneBy: 'rector@example.com', doneAt: new Date(AT) },
      ]);
    });
  });
});
