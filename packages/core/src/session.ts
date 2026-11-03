import type { Instant } from './clock.js';

// A Rector stays logged in for 12 hours, long enough for one working Day (FR-13).
const SESSION_LENGTH_MS = 12 * 60 * 60 * 1000;

export function sessionExpiresAt(loggedInAt: Instant): Instant {
  return loggedInAt + SESSION_LENGTH_MS;
}

export function isSessionExpired(session: { expiresAt: Instant }, now: Instant): boolean {
  return now >= session.expiresAt;
}
