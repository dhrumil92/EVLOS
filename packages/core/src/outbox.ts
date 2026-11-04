import type { Instant } from './clock.js';

// An email is tried this many times at most, then given up and left for the Rector to see.
const MAX_ATTEMPTS = 3;
const RETRY_GAP_MS = 5 * 60 * 1000;

export type AfterFailedSend = { status: 'queued'; sendAfter: Instant } | { status: 'failed' };

// What happens to an email the email provider refused. attempts includes the one that failed.
export function afterFailedSend(attempts: number, failedAt: Instant): AfterFailedSend {
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed' };
  return { status: 'queued', sendAfter: failedAt + RETRY_GAP_MS };
}
