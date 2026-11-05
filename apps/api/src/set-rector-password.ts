// Sets a new password for a Rector who is locked out and cannot use the emailed link:
// npm run rector:password -- rector@example.com
// For the developer on the server, not a page. The password is typed at a hidden prompt.
// Every login of the Rector ends, and any open reset link stops working.
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { argon2Passwords, randomSessionTokens } from './adapters/login/passwords.js';
import { PostgresRectorRepository } from './adapters/postgres/rector-repository.js';
import { askNewPassword } from './hidden-prompt.js';
import { setRectorPassword } from './use-cases/rector-login.js';
import type { SetPasswordResult } from './use-cases/rector-login.js';

const ANSWERS: Record<SetPasswordResult, string> = {
  set: 'The password is changed. Every login of this Rector has ended.',
  'no-account': 'No Rector logs in with this email. Nothing was changed.',
  'password-too-short': 'The password needs at least 12 characters. Nothing was changed.',
};

const email = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (email === undefined || databaseUrl === undefined) {
  console.error('Use: npm run rector:password -- rector@example.com (with DATABASE_URL in .env)');
  process.exit(1);
}

const password = await askNewPassword();
if (password === null) {
  console.error('The two passwords differ. Nothing was changed.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const result = await setRectorPassword(email, password, {
  rectors: new PostgresRectorRepository(drizzle(pool)),
  passwords: argon2Passwords,
  tokens: randomSessionTokens,
  clock: { now: () => Date.now() },
});
await pool.end();
console.log(ANSWERS[result]);
process.exit(result === 'set' ? 0 : 1);
