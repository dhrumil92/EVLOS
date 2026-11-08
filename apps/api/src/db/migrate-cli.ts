import { migrateDatabase } from './migrate.js';

// Brings the database in DATABASE_URL up to the latest migration. Unlike `npm run db:setup`, it
// does not touch a test database, so it is the one to run on the VM:
//   docker compose run --rm api node apps/api/dist/db/migrate-cli.js
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is not set.');
}

await migrateDatabase(databaseUrl);
console.log('migrate: the database is up to date.');
