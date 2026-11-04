import { isEmailAddress } from '@evlos/core';

// The addresses in REPORT_EMAIL, which receive the Review Reminder, Daily Report and
// Monthly Report. Written in .env, split by commas. Empty when it is not set, and then no
// such email is queued. A wrong entry stops the server at start, named by its place only.
export function reportEmailAddressesFrom(env: Record<string, string | undefined>): string[] {
  const entries = (env.REPORT_EMAIL ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  entries.forEach((entry, index) => {
    if (!isEmailAddress(entry)) {
      throw new Error(
        `REPORT_EMAIL entry ${String(index + 1)} is not an email address. Check .env.`,
      );
    }
  });
  return [...new Set(entries)];
}
