// Creates the Rector's login: npm run rector:create -- rector@example.com
// The password is typed at a hidden prompt, so it never appears on screen, in the shell
// history, in .env or in the code.
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { argon2Passwords, randomSessionTokens } from './adapters/login/passwords.js';
import { PostgresRectorRepository } from './adapters/postgres/rector-repository.js';
import { askNewPassword } from './hidden-prompt.js';
import { createRector } from './use-cases/rector-login.js';
import type { CreateRectorResult } from './use-cases/rector-login.js';

const ANSWERS: Record<CreateRectorResult, string> = {
  created: 'The Rector can now log in with this email.',
  'invalid-email': 'That is not an email address. Nothing was saved.',
  'password-too-short': 'The password needs at least 12 characters. Nothing was saved.',
  'email-used': 'This email already has a login. Nothing was saved.',
};

const email = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (email === undefined || databaseUrl === undefined) {
  console.error('Use: npm run rector:create -- rector@example.com (with DATABASE_URL in .env)');
  process.exit(1);
}

const password = await askNewPassword();
if (password === null) {
  console.error('The two passwords differ. Nothing was saved.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const result = await createRector(email, password, {
  rectors: new PostgresRectorRepository(drizzle(pool)),
  passwords: argon2Passwords,
  tokens: randomSessionTokens,
  clock: { now: () => Date.now() },
});
await pool.end();
console.log(ANSWERS[result]);
process.exit(result === 'created' ? 0 : 1);
