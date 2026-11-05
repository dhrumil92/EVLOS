import type { Instant } from '@evlos/core';
import { asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, reportRecipients } from '../../db/schema.js';
import type { ReportRecipientRepository } from '../../ports/report-recipient-repository.js';

export class PostgresReportRecipientRepository implements ReportRecipientRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(): Promise<string[]> {
    const rows = await this.db
      .select({ email: reportRecipients.email })
      .from(reportRecipients)
      .orderBy(asc(reportRecipients.addedAt), asc(reportRecipients.email));
    return rows.map((row) => row.email);
  }

  // The address and its audit row are saved together, or not at all.
  add(email: string, at: Instant, doneBy: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const added = await tx
        .insert(reportRecipients)
        .values({ email, addedAt: new Date(at) })
        .onConflictDoNothing()
        .returning({ email: reportRecipients.email });
      if (added.length === 0) return false;
      await tx
        .insert(auditLog)
        .values({ action: 'Add Report Recipient', detail: email, doneAt: new Date(at), doneBy });
      return true;
    });
  }

  remove(email: string, at: Instant, doneBy: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(reportRecipients)
        .where(eq(reportRecipients.email, email))
        .returning({ email: reportRecipients.email });
      if (removed.length === 0) return false;
      await tx.insert(auditLog).values({
        action: 'Remove Report Recipient',
        detail: email,
        doneAt: new Date(at),
        doneBy,
      });
      return true;
    });
  }
}
