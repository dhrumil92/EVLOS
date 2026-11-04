import { afterFailedSend } from '@evlos/core';
import type { Clock } from '@evlos/core';
import type { Notifier } from '../ports/notifier.js';
import type { OutboxRepository } from '../ports/outbox-repository.js';

export interface SendDueEmailsDeps {
  outbox: OutboxRepository;
  notifier: Notifier;
  clock: Clock;
}

export interface SendSummary {
  sent: number;
  notSent: number;
  // The provider's error code for each email not sent. Never the recipient (NFR-5).
  problems: string[];
}

// How many emails one run sends at most; the rest wait for the next run.
const BATCH = 20;

const codeOf = (error: unknown): string =>
  error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown';

// Sends every queued email that is due (FR-9). Each email is taken from the outbox before it
// is handed to the provider, so it is never sent twice, even after a crash (rule 5).
export async function sendDueEmails(deps: SendDueEmailsDeps): Promise<SendSummary> {
  const due = await deps.outbox.takeDue(deps.clock.now(), BATCH);
  const problems: string[] = [];
  for (const { id, attempts, ...email } of due) {
    try {
      await deps.notifier.send(email);
    } catch (error) {
      problems.push(codeOf(error));
      await deps.outbox.markNotSent(id, afterFailedSend(attempts, deps.clock.now()));
      continue;
    }
    await deps.outbox.markSent(id, deps.clock.now());
  }
  return { sent: due.length - problems.length, notSent: problems.length, problems };
}
