import type { AfterFailedSend, Instant } from '@evlos/core';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { outboxEmails } from '../../db/schema.js';
import type { OutboxRepository, TakenEmail } from '../../ports/outbox-repository.js';

// queued -> sending -> sent, or back to queued for a retry, or failed for good. A row left
// in sending by a crash is never taken again, so its email is never sent twice (rule 5).
const isTaken = (id: number) => and(eq(outboxEmails.id, id), eq(outboxEmails.status, 'sending'));

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async takeDue(now: Instant, limit: number): Promise<TakenEmail[]> {
    const isDue = and(
      eq(outboxEmails.status, 'queued'),
      lte(outboxEmails.sendAfter, new Date(now)),
    );
    // Rows another run has locked are skipped rather than waited for, and the status is
    // checked again in the update, so two runs at once never take the same email.
    const due = this.db
      .select({ id: outboxEmails.id })
      .from(outboxEmails)
      .where(isDue)
      .orderBy(asc(outboxEmails.id))
      .limit(limit)
      .for('update', { skipLocked: true });
    const taken = await this.db
      .update(outboxEmails)
      .set({ status: 'sending', attempts: sql`${outboxEmails.attempts} + 1` })
      .where(and(inArray(outboxEmails.id, due), eq(outboxEmails.status, 'queued')))
      .returning({
        id: outboxEmails.id,
        attempts: outboxEmails.attempts,
        recipient: outboxEmails.recipient,
        subject: outboxEmails.subject,
        body: outboxEmails.body,
      });
    return taken.sort((first, second) => first.id - second.id);
  }

  async markSent(id: number, at: Instant): Promise<void> {
    await this.db
      .update(outboxEmails)
      .set({ status: 'sent', sentAt: new Date(at) })
      .where(isTaken(id));
  }

  async markNotSent(id: number, next: AfterFailedSend): Promise<void> {
    const change =
      next.status === 'queued'
        ? { status: 'queued', sendAfter: new Date(next.sendAfter) }
        : { status: 'failed' };
    await this.db.update(outboxEmails).set(change).where(isTaken(id));
  }
}
