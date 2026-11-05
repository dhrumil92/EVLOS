import type { Instant } from './clock.js';

// A Rector stays logged in for 12 hours, long enough for one working Day (FR-13).
const SESSION_LENGTH_MS = 12 * 60 * 60 * 1000;

export function sessionExpiresAt(loggedInAt: Instant): Instant {
  return loggedInAt + SESSION_LENGTH_MS;
}

export function isSessionExpired(session: { expiresAt: Instant }, now: Instant): boolean {
  return now >= session.expiresAt;
}

// A password reset link works for 30 minutes: long enough to open the email, short enough
// that an old email left in an inbox is no use.
const RESET_LINK_LENGTH_MS = 30 * 60 * 1000;

export function resetLinkExpiresAt(askedAt: Instant): Instant {
  return askedAt + RESET_LINK_LENGTH_MS;
}
