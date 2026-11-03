import { describe, expect, it } from 'vitest';
import { argon2Passwords, randomSessionTokens, STAND_IN_PASSWORD } from './passwords.js';

const PASSWORD = 'a long enough password';

describe('argon2Passwords', () => {
  it('hashes with Argon2id and never keeps the password itself', async () => {
    const hash = await argon2Passwords.hash(PASSWORD);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(PASSWORD);
  });

  it('accepts the right password', async () => {
    const hash = await argon2Passwords.hash(PASSWORD);

    expect(await argon2Passwords.verify(hash, PASSWORD)).toBe(true);
  });

  it('refuses a wrong password', async () => {
    const hash = await argon2Passwords.hash(PASSWORD);

    expect(await argon2Passwords.verify(hash, 'a wrong password!')).toBe(false);
  });

  it('refuses when there is no hash, after still doing a check', async () => {
    expect(await argon2Passwords.verify(null, PASSWORD)).toBe(false);
  });

  it('refuses an unknown email even when the stand-in password is typed', async () => {
    expect(await argon2Passwords.verify(null, STAND_IN_PASSWORD)).toBe(false);
  });
});

describe('randomSessionTokens', () => {
  it('makes a different long token each time', () => {
    const first = randomSessionTokens.create();

    expect(first).toHaveLength(43);
    expect(randomSessionTokens.create()).not.toBe(first);
  });

  it('hashes a token the same way every time, and not to itself', () => {
    const token = randomSessionTokens.create();

    expect(randomSessionTokens.hashOf(token)).toBe(randomSessionTokens.hashOf(token));
    expect(randomSessionTokens.hashOf(token)).not.toBe(token);
  });
});
