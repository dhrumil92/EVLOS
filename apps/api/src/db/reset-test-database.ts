import pg from 'pg';
import { assertTestDatabase } from './test-database.js';

// Empties the test database so each test starts from nothing. Refuses any database but evlos_test.
export async function resetTestDatabase(url: string | undefined): Promise<void> {
  assertTestDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('drop schema if exists drizzle cascade');
    await client.query('drop schema public cascade');
    await client.query('create schema public');
  } finally {
    await client.end();
  }
}
