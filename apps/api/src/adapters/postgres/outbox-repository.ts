import type { AfterFailedSend, Instant } from '@evlos/core';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { outboxAttachments, outboxEmails } from '../../db/schema.js';
import type { Attachment } from '../../ports/notifier.js';
import type { OutboxRepository, OutgoingEmail, TakenEmail } from '../../ports/outbox-repository.js';

// queued -> sending -> sent, or back to queued for a retry, or failed for good. A row left
// in sending by a crash is never taken again, so its email is never sent twice (rule 5).
const isTaken = (id: number) => and(eq(outboxEmails.id, id), eq(outboxEmails.status, 'sending'));

// The rows that keep one queued email's attachments, numbered in their order.
const attachmentRows = (outboxEmailId: number, email: OutgoingEmail | undefined) =>
  (email?.attachments ?? []).map((file, position) => ({
    outboxEmailId,
    position,
    fileName: file.filename,
    content: file.content,
  }));

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // The email and its attachments are saved together, or not at all.
  async queue(emails: OutgoingEmail[]): Promise<number> {
    if (emails.length === 0) return 0;
    return this.db.transaction(async (tx) => {
      const queued = await tx
        .insert(outboxEmails)
        .values(
          emails.map((email) => ({
            kind: email.kind,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            html: email.html ?? null,
            dedupeKey: email.dedupeKey,
            sendAfter: new Date(email.sendAfter),
          })),
        )
        // The unique dedupe key turns a second request for the same email into nothing, so
        // its attachments are not saved a second time either.
        .onConflictDoNothing()
        .returning({ id: outboxEmails.id, dedupeKey: outboxEmails.dedupeKey });
      const files = queued.flatMap(({ id, dedupeKey }) =>
        attachmentRows(
          id,
          emails.find((email) => email.dedupeKey === dedupeKey),
        ),
      );
      if (files.length > 0) await tx.insert(outboxAttachments).values(files);
      return queued.length;
    });
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
        html: outboxEmails.html,
      });
    const files = await this.attachmentsOf(taken.map((email) => email.id));
    return taken
      .sort((first, second) => first.id - second.id)
      .map(({ html, ...email }) => ({
        ...email,
        // An email queued before the layout existed has no HTML and goes out as plain text.
        ...(html === null ? {} : { html }),
        attachments: files.get(email.id) ?? [],
      }));
  }

  // The attachments of the given emails, by email id, each list in position order.
  private async attachmentsOf(ids: number[]): Promise<Map<number, Attachment[]>> {
    const byEmail = new Map<number, Attachment[]>();
    if (ids.length === 0) return byEmail;
    const files = await this.db
      .select()
      .from(outboxAttachments)
      .where(inArray(outboxAttachments.outboxEmailId, ids))
      .orderBy(asc(outboxAttachments.outboxEmailId), asc(outboxAttachments.position));
    for (const file of files) {
      const list = byEmail.get(file.outboxEmailId) ?? [];
      list.push({ filename: file.fileName, content: file.content });
      byEmail.set(file.outboxEmailId, list);
    }
    return byEmail;
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
