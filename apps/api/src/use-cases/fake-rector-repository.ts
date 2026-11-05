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
  const resets = new Map<string, { rectorId: number; expiresAt: Instant; isUsed: boolean }>();
  let nextToken = 1;

  // Ends the Rector's sessions, except the one with keepTokenHash.
  const endSessions = (rectorId: number, keepTokenHash: string | null) => {
    for (const [tokenHash, session] of sessions) {
      if (session.rectorId === rectorId && tokenHash !== keepTokenHash) sessions.delete(tokenHash);
    }
  };

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
      endSessions(rectorId, keepTokenHash);
      audit.push({ action: 'Change Password', doneAt: at, doneBy });
      return Promise.resolve();
    },
    addPasswordReset: (tokenHash, rectorId, expiresAt) => {
      resets.set(tokenHash, { rectorId, expiresAt, isUsed: false });
      return Promise.resolve();
    },
    resetPassword: (tokenHash, passwordHash, at) => {
      const reset = resets.get(tokenHash);
      const account = accounts.find((one) => one.rector.id === reset?.rectorId);
      if (!reset || !account || reset.isUsed || at >= reset.expiresAt) {
        return Promise.resolve(false);
      }
      account.passwordHash = passwordHash;
      for (const other of resets.values()) {
        if (other.rectorId === reset.rectorId) other.isUsed = true;
      }
      endSessions(reset.rectorId, null);
      audit.push({ action: 'Reset Password', doneAt: at, doneBy: account.rector.email });
      return Promise.resolve(true);
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
  return { rectors, passwords, tokens, accounts, sessions, checked, audit, resets };
}
