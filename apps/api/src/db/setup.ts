import { migrateDatabase } from './migrate.js';
import { assertTestDatabase } from './test-database.js';

// `npm run db:setup`: brings the development and test databases up to the latest migration.
const developmentUrl = process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (developmentUrl === undefined) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}
assertTestDatabase(testUrl);

await migrateDatabase(developmentUrl);
await migrateDatabase(testUrl);
console.log('db:setup: development and test databases are up to date.');
