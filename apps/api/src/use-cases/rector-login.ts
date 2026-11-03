import { isEmailAddress, isSessionExpired, sessionExpiresAt } from '@evlos/core';
import type { Clock, Instant } from '@evlos/core';
import type { Passwords, SessionTokens } from '../ports/passwords.js';
import type { Rector, RectorRepository } from '../ports/rector-repository.js';

export interface RectorLoginDeps {
  rectors: RectorRepository;
  passwords: Passwords;
  tokens: SessionTokens;
  clock: Clock;
}

export type CreateRectorResult = 'created' | 'invalid-email' | 'password-too-short' | 'email-used';
export type LogInResult =
  { outcome: 'logged-in'; token: string; expiresAt: Instant } | { outcome: 'refused' };

const MIN_PASSWORD_LENGTH = 12;

const cleanEmail = (email: string) => email.trim().toLowerCase();

export async function createRector(
  email: string,
  password: string,
  deps: RectorLoginDeps,
): Promise<CreateRectorResult> {
  const cleaned = cleanEmail(email);
  if (!isEmailAddress(cleaned)) return 'invalid-email';
  if (password.length < MIN_PASSWORD_LENGTH) return 'password-too-short';
  const added = await deps.rectors.add(cleaned, await deps.passwords.hash(password));
  return added ? 'created' : 'email-used';
}

export async function logIn(
  email: string,
  password: string,
  deps: RectorLoginDeps,
): Promise<LogInResult> {
  const account = await deps.rectors.findByEmail(cleanEmail(email));
  // Checked even for an unknown email, so the answer takes as long either way.
  const isRight = await deps.passwords.verify(account?.passwordHash ?? null, password);
  if (account === null || !isRight) {
    return { outcome: 'refused' };
  }
  const token = deps.tokens.create();
  const expiresAt = sessionExpiresAt(deps.clock.now());
  await deps.rectors.addSession(deps.tokens.hashOf(token), account.rector.id, expiresAt);
  return { outcome: 'logged-in', token, expiresAt };
}

export async function rectorOfSession(
  token: string,
  deps: RectorLoginDeps,
): Promise<Rector | null> {
  const tokenHash = deps.tokens.hashOf(token);
  const session = await deps.rectors.sessionOf(tokenHash);
  if (session === null) return null;
  if (isSessionExpired(session, deps.clock.now())) {
    await deps.rectors.removeSession(tokenHash);
    return null;
  }
  return session.rector;
}

export async function logOut(token: string, deps: RectorLoginDeps): Promise<void> {
  await deps.rectors.removeSession(deps.tokens.hashOf(token));
}
