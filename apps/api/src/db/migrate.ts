import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// apps/api/migrations, reached the same way from src/db (tests) and dist/db (db:setup).
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../migrations', import.meta.url));

// Applies every migration the database has not had yet; already-applied ones are skipped.
export async function migrateDatabase(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
