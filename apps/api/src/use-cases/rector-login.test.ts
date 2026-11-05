import { describe, expect, it } from 'vitest';
import { fakeLogin } from './fake-rector-repository.js';
import { changePassword, createRector, logIn, logOut, rectorOfSession } from './rector-login.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 3, 3, 0, 0);
const EMAIL = 'rector@example.com';
const PASSWORD = 'a long enough password';

async function withRector(now = NOW) {
  const fake = fakeLogin();
  const clock = { now: () => now };
  const deps = { ...fake, clock };
  await createRector(EMAIL, PASSWORD, deps);
  return { ...fake, deps };
}

describe('createRector', () => {
  it('keeps only a hash of the password', async () => {
    const { accounts } = await withRector();

    expect(accounts[0]?.passwordHash).toBe(`hashed:${PASSWORD}`);
  });

  it('stores the email trimmed and in lower case', async () => {
    const fake = fakeLogin();

    await createRector('  Rector@Example.COM ', PASSWORD, { ...fake, clock: { now: () => NOW } });

    expect(fake.accounts[0]?.rector.email).toBe(EMAIL);
  });

  it('refuses a password shorter than 12 characters', async () => {
    const fake = fakeLogin();

    const result = await createRector(EMAIL, 'short', { ...fake, clock: { now: () => NOW } });

    expect(result).toBe('password-too-short');
    expect(fake.accounts).toEqual([]);
  });

  it('refuses an email that is not an email address', async () => {
    const fake = fakeLogin();

    const result = await createRector('rector', PASSWORD, { ...fake, clock: { now: () => NOW } });

    expect(result).toBe('invalid-email');
  });

  it('refuses an email that already has an account', async () => {
    const { deps } = await withRector();

    expect(await createRector(EMAIL, PASSWORD, deps)).toBe('email-used');
  });
});

describe('logIn', () => {
  it('starts a 12-hour session for the right email and password', async () => {
    const { deps, sessions } = await withRector();

    const result = await logIn(EMAIL, PASSWORD, deps);

    expect(result).toEqual({ outcome: 'logged-in', token: 'token-1', expiresAt: NOW + 12 * HOUR });
    expect(sessions.get('hash-of-token-1')).toEqual({ rectorId: 1, expiresAt: NOW + 12 * HOUR });
  });

  it('stores only a hash of the session token', async () => {
    const { deps, sessions } = await withRector();

    await logIn(EMAIL, PASSWORD, deps);

    expect(sessions.has('token-1')).toBe(false);
  });

  it('accepts the email in any case and with spaces around it', async () => {
    const { deps } = await withRector();

    const result = await logIn(' RECTOR@example.com ', PASSWORD, deps);

    expect(result.outcome).toBe('logged-in');
  });

  it('refuses a wrong password and starts no session', async () => {
    const { deps, sessions } = await withRector();

    const result = await logIn(EMAIL, 'a wrong password!', deps);

    expect(result).toEqual({ outcome: 'refused' });
    expect(sessions.size).toBe(0);
  });

  it('still checks a password for an unknown email, so it takes as long', async () => {
    const { deps, checked } = await withRector();

    const result = await logIn('someone@example.com', PASSWORD, deps);

    expect(result).toEqual({ outcome: 'refused' });
    expect(checked).toEqual([null]);
  });
});

describe('rectorOfSession', () => {
  it('finds the Rector of a valid session', async () => {
    const { deps } = await withRector();
    await logIn(EMAIL, PASSWORD, deps);

    expect(await rectorOfSession('token-1', deps)).toEqual({ id: 1, email: EMAIL });
  });

  it('finds no Rector for an unknown token', async () => {
    const { deps } = await withRector();

    expect(await rectorOfSession('made-up', deps)).toBeNull();
  });

  it('ends an expired session and finds no Rector', async () => {
    const { deps, sessions } = await withRector();
    await logIn(EMAIL, PASSWORD, deps);
    const later = { ...deps, clock: { now: () => NOW + 12 * HOUR } };

    expect(await rectorOfSession('token-1', later)).toBeNull();
    expect(sessions.size).toBe(0);
  });
});

describe('logOut', () => {
  it('ends the session', async () => {
    const { deps } = await withRector();
    await logIn(EMAIL, PASSWORD, deps);

    await logOut('token-1', deps);

    expect(await rectorOfSession('token-1', deps)).toBeNull();
  });
});

describe('changePassword', () => {
  const NEW_PASSWORD = 'another long password';
  const RECTOR = { id: 1, email: EMAIL };

  // The Rector logged in twice, as on a laptop (token-1) and a phone (token-2).
  async function loggedInTwice() {
    const fake = await withRector();
    await logIn(EMAIL, PASSWORD, fake.deps);
    await logIn(EMAIL, PASSWORD, fake.deps);
    return fake;
  }

  it('changes the password, so only the new one logs in', async () => {
    const { deps } = await loggedInTwice();

    const result = await changePassword(RECTOR, 'token-1', PASSWORD, NEW_PASSWORD, deps);

    expect(result).toBe('changed');
    expect((await logIn(EMAIL, NEW_PASSWORD, deps)).outcome).toBe('logged-in');
    expect((await logIn(EMAIL, PASSWORD, deps)).outcome).toBe('refused');
  });

  it('ends every other login of the Rector and keeps this one', async () => {
    const { deps } = await loggedInTwice();

    await changePassword(RECTOR, 'token-1', PASSWORD, NEW_PASSWORD, deps);

    expect(await rectorOfSession('token-1', deps)).toEqual(RECTOR);
    expect(await rectorOfSession('token-2', deps)).toBeNull();
  });

  it('records who changed the password and when, never the password', async () => {
    const { deps, audit } = await loggedInTwice();

    await changePassword(RECTOR, 'token-1', PASSWORD, NEW_PASSWORD, deps);

    expect(audit).toEqual([{ action: 'Change Password', doneAt: NOW, doneBy: EMAIL }]);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const { deps, accounts, audit } = await loggedInTwice();

    const result = await changePassword(RECTOR, 'token-1', 'not the password', NEW_PASSWORD, deps);

    expect(result).toBe('wrong-password');
    expect(accounts[0]?.passwordHash).toBe(`hashed:${PASSWORD}`);
    expect(await rectorOfSession('token-2', deps)).toEqual(RECTOR);
    expect(audit).toEqual([]);
  });

  it('refuses a new password shorter than 12 characters', async () => {
    const { deps, accounts } = await loggedInTwice();

    const result = await changePassword(RECTOR, 'token-1', PASSWORD, 'short', deps);

    expect(result).toBe('password-too-short');
    expect(accounts[0]?.passwordHash).toBe(`hashed:${PASSWORD}`);
  });

  it('refuses a new password that is the same as the current one', async () => {
    const { deps, audit } = await loggedInTwice();

    const result = await changePassword(RECTOR, 'token-1', PASSWORD, PASSWORD, deps);

    expect(result).toBe('same-password');
    expect(await rectorOfSession('token-2', deps)).toEqual(RECTOR);
    expect(audit).toEqual([]);
  });
});
