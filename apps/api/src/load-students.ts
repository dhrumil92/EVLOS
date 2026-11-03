// The one-time first load of the Rector's list (FR-1):
//   npm run students:load -- path/to/list.csv          checks every row, saves nothing
//   npm run students:load -- path/to/list.csv --save   saves all Students, or none
// Save the Rector's Excel as "CSV UTF-8". Delete the file afterwards: it holds personal data.
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { PostgresStudentRepository } from './adapters/postgres/student-repository.js';
import { readRoster } from './adapters/roster/read-roster.js';
import { loadRoster } from './use-cases/load-roster.js';

const [file, flag] = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;
if (file === undefined || databaseUrl === undefined) {
  console.error('Use: npm run students:load -- list.csv [--save] (with DATABASE_URL in .env)');
  process.exit(1);
}

const roster = readRoster(await readFile(file, 'utf8'));
if (roster.problem !== null) {
  console.error(roster.problem);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const result = await loadRoster(roster.rows, flag === '--save', {
  students: new PostgresStudentRepository(drizzle(pool)),
  clock: { now: () => Date.now() },
});
await pool.end();

console.log(`${String(result.ready)} Students ready to load.`);
if (result.problems.length > 0) {
  console.log(`${String(result.problems.length)} problems to fix:`);
  for (const problem of result.problems) console.log(`  ${problem}`);
}
if (result.saved) {
  console.log(`Saved ${String(result.ready)} Students, each Active from today.`);
} else {
  const why = result.problems.length > 0 ? 'Fix the file and run it again.' : 'Add --save to save.';
  console.log(`Nothing was saved. ${why}`);
}
process.exit(result.problems.length > 0 ? 1 : 0);
