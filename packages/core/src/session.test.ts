import { describe, expect, it } from 'vitest';
import { isSessionExpired, resetLinkExpiresAt, sessionExpiresAt } from './session.js';

const HOUR = 60 * 60 * 1000;
const LOGGED_IN_AT = Date.UTC(2026, 10, 3, 3, 0, 0);

describe('Rector session', () => {
  it('lasts 12 hours from login', () => {
    expect(sessionExpiresAt(LOGGED_IN_AT)).toBe(LOGGED_IN_AT + 12 * HOUR);
  });

  it('is still valid just before it expires', () => {
    const session = { expiresAt: sessionExpiresAt(LOGGED_IN_AT) };

    expect(isSessionExpired(session, LOGGED_IN_AT + 12 * HOUR - 1)).toBe(false);
  });

  it('has expired at the moment it expires', () => {
    const session = { expiresAt: sessionExpiresAt(LOGGED_IN_AT) };

    expect(isSessionExpired(session, LOGGED_IN_AT + 12 * HOUR)).toBe(true);
  });
});

describe('password reset link', () => {
  it('works for 30 minutes from when it was asked for', () => {
    expect(resetLinkExpiresAt(LOGGED_IN_AT)).toBe(LOGGED_IN_AT + HOUR / 2);
  });
});
