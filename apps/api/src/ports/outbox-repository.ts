import type { AfterFailedSend, Instant } from '@evlos/core';
import type { Email } from './notifier.js';

// attempts counts the attempt the email was just taken for.
export type TakenEmail = Email & { id: number; attempts: number };

export interface OutboxRepository {
  // Takes up to `limit` queued emails that are due, oldest first, and marks them as being
  // sent, so no later run can take them again. An email is never sent twice (rule 5).
  takeDue(now: Instant, limit: number): Promise<TakenEmail[]>;
  markSent(id: number, at: Instant): Promise<void>;
  // Queues the email again for later, or gives it up.
  markNotSent(id: number, next: AfterFailedSend): Promise<void>;
}
