import type { AfterFailedSend, Instant } from '@evlos/core';
import type { Email } from './notifier.js';

export type EmailKind = 'Notification' | 'Review Reminder' | 'Daily Report' | 'Monthly Report';

// An email to queue. Its dedupe key says which email it is, such as the Daily Report of one
// Day for one address, so the same email is never queued twice.
export type OutgoingEmail = Email & { kind: EmailKind; dedupeKey: string; sendAfter: Instant };

// attempts counts the attempt the email was just taken for.
export type TakenEmail = Email & { id: number; attempts: number };

export interface OutboxRepository {
  // Queues each email whose dedupe key is new, with its attachments. Returns how many were
  // queued.
  queue(emails: OutgoingEmail[]): Promise<number>;
  // Takes up to `limit` queued emails that are due, oldest first, and marks them as being
  // sent, so no later run can take them again. An email is never sent twice (rule 5).
  takeDue(now: Instant, limit: number): Promise<TakenEmail[]>;
  markSent(id: number, at: Instant): Promise<void>;
  // Queues the email again for later, or gives it up.
  markNotSent(id: number, next: AfterFailedSend): Promise<void>;
}
