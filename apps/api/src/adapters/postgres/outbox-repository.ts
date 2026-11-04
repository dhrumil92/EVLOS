import type { AfterFailedSend, Instant } from '@evlos/core';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { outboxEmails } from '../../db/schema.js';
import type { OutboxRepository, OutgoingEmail, TakenEmail } from '../../ports/outbox-repository.js';

// queued -> sending -> sent, or back to queued for a retry, or failed for good. A row left
// in sending by a crash is never taken again, so its email is never sent twice (rule 5).
const isTaken = (id: number) => and(eq(outboxEmails.id, id), eq(outboxEmails.status, 'sending'));

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async queue(emails: OutgoingEmail[]): Promise<number> {
    if (emails.length === 0) return 0;
    const queued = await this.db
      .insert(outboxEmails)
      .values(
        emails.map((email) => ({
          kind: email.kind,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          attachmentName: email.attachment?.filename ?? null,
          attachment: email.attachment?.content ?? null,
          dedupeKey: email.dedupeKey,
          sendAfter: new Date(email.sendAfter),
        })),
      )
      // The unique dedupe key turns a second request for the same email into nothing.
      .onConflictDoNothing()
      .returning({ id: outboxEmails.id });
    return queued.length;
  }

  async takeDue(now: Instant, limit: number): Promise<TakenEmail[]> {
    const isDue = and(
      eq(outboxEmails.status, 'queued'),
      lte(outboxEmails.sendAfter, new Date(now)),
    );
    // Rows another run has locked are skipped rather than waited for, and the status is
    // checked again in the update, so two runs at once never take the same email. The due
    // rows are picked in a WITH clause, which PostgreSQL runs exactly once; a subquery in
    // the WHERE clause may be run again and take more rows than the limit.
    const due = this.db
      .$with('due')
      .as(
        this.db
          .select({ id: outboxEmails.id })
          .from(outboxEmails)
          .where(isDue)
          .orderBy(asc(outboxEmails.id))
          .limit(limit)
          .for('update', { skipLocked: true }),
      );
    const taken = await this.db
      .with(due)
      .update(outboxEmails)
      .set({ status: 'sending', attempts: sql`${outboxEmails.attempts} + 1` })
      .from(due)
      .where(and(eq(outboxEmails.id, due.id), eq(outboxEmails.status, 'queued')))
      .returning({
        id: outboxEmails.id,
        attempts: outboxEmails.attempts,
        recipient: outboxEmails.recipient,
        subject: outboxEmails.subject,
        body: outboxEmails.body,
        attachmentName: outboxEmails.attachmentName,
        attachment: outboxEmails.attachment,
      });
    return taken
      .sort((first, second) => first.id - second.id)
      .map(({ attachmentName, attachment, ...email }) => ({
        ...email,
        attachment:
          attachmentName === null || attachment === null
            ? null
            : { filename: attachmentName, content: attachment },
      }));
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
