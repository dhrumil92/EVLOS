import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Passwords, SessionTokens } from '../../ports/passwords.js';

// A real Argon2 hash of a throwaway password, checked when the email is unknown.
export const STAND_IN_PASSWORD = 'stand-in password, never used to log in';
let standIn: Promise<string> | null = null;
const standInHash = () => (standIn ??= hash(STAND_IN_PASSWORD));

// Argon2id with the library's defaults (19 MiB memory, 2 passes), as OWASP recommends.
export const argon2Passwords: Passwords = {
  hash: (password) => hash(password),
  async verify(passwordHash, password) {
    const isRight = await verify(passwordHash ?? (await standInHash()), password);
    return passwordHash !== null && isRight;
  },
};

// 32 random bytes is 256 bits, too many to guess. Only the SHA-256 of a token is stored;
// a slow hash is not needed because the token is random, not a chosen password.
export const randomSessionTokens: SessionTokens = {
  create: () => randomBytes(32).toString('base64url'),
  hashOf: (token) => createHash('sha256').update(token).digest('hex'),
};
