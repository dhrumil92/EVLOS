import type { Instant } from '@evlos/core';
import type { Passwords, SessionTokens } from '../ports/passwords.js';
import type { Rector, RectorRepository } from '../ports/rector-repository.js';

// In-memory stand-ins for login use-case tests. The fake password hash is readable on
// purpose; the real Argon2 adapter has its own tests.
export function fakeLogin() {
  const accounts: { rector: Rector; passwordHash: string }[] = [];
  const sessions = new Map<string, { rectorId: number; expiresAt: Instant }>();
  const checked: (string | null)[] = [];
  const audit: { action: string; doneAt: Instant; doneBy: string }[] = [];
  let nextToken = 1;

  const rectors: RectorRepository = {
    add: (email, passwordHash) => {
      if (accounts.some((one) => one.rector.email === email)) return Promise.resolve(false);
      accounts.push({ rector: { id: accounts.length + 1, email }, passwordHash });
      return Promise.resolve(true);
    },
    findByEmail: (email) =>
      Promise.resolve(accounts.find((one) => one.rector.email === email) ?? null),
    addSession: (tokenHash, rectorId, expiresAt) => {
      sessions.set(tokenHash, { rectorId, expiresAt });
      return Promise.resolve();
    },
    sessionOf: (tokenHash) => {
      const session = sessions.get(tokenHash);
      const account = accounts.find((one) => one.rector.id === session?.rectorId);
      return Promise.resolve(
        session && account ? { rector: account.rector, expiresAt: session.expiresAt } : null,
      );
    },
    removeSession: (tokenHash) => {
      sessions.delete(tokenHash);
      return Promise.resolve();
    },
    changePassword: (rectorId, passwordHash, keepTokenHash, at, doneBy) => {
      const account = accounts.find((one) => one.rector.id === rectorId);
      if (account) account.passwordHash = passwordHash;
      for (const [tokenHash, session] of sessions) {
        if (session.rectorId === rectorId && tokenHash !== keepTokenHash)
          sessions.delete(tokenHash);
      }
      audit.push({ action: 'Change Password', doneAt: at, doneBy });
      return Promise.resolve();
    },
  };
  const passwords: Passwords = {
    hash: (password) => Promise.resolve(`hashed:${password}`),
    verify: (passwordHash, password) => {
      checked.push(passwordHash);
      return Promise.resolve(passwordHash === `hashed:${password}`);
    },
  };
  const tokens: SessionTokens = {
    create: () => `token-${String(nextToken++)}`,
    hashOf: (token) => `hash-of-${token}`,
  };
  return { rectors, passwords, tokens, accounts, sessions, checked, audit };
}
