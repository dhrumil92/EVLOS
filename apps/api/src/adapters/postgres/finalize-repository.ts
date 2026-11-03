import type { Day, Instant } from '@evlos/core';
import { and, asc, between, eq, inArray, isNull, like } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, dayFinalizations, outboxEmails, poojaResults } from '../../db/schema.js';
import type {
  FinalStatus,
  Finalization,
  FinalizeRepository,
  Notification,
  PoojaResult,
} from '../../ports/finalize-repository.js';

const dedupeKeyOf = (day: Day, studentId: string) => `Notification|${day}|${studentId}`;
const toDate = (instant: Instant | null) => (instant === null ? null : new Date(instant));

export class PostgresFinalizeRepository implements FinalizeRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async finalizationsBetween(first: Day, last: Day): Promise<Finalization[]> {
    const rows = await this.db
      .select()
      .from(dayFinalizations)
      .where(between(dayFinalizations.day, first, last))
      .orderBy(asc(dayFinalizations.day));
    return rows.map((row) => ({ ...row, finalizedAt: row.finalizedAt.getTime() }));
  }

  finalize(
    day: Day,
    results: Omit<PoojaResult, 'excludedAt'>[],
    at: Instant,
    doneBy: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const locked = await tx
        .insert(dayFinalizations)
        .values({ day, finalizedBy: doneBy, finalizedAt: new Date(at) })
        .onConflictDoNothing()
        .returning({ day: dayFinalizations.day });
      if (locked.length === 0) return false;
      if (results.length > 0) {
        await tx.insert(poojaResults).values(
          results.map((result) => ({
            ...result,
            day,
            firstPunchAt: toDate(result.firstPunchAt),
          })),
        );
      }
      await tx.insert(auditLog).values({ action: 'Finalize', doneAt: new Date(at), doneBy });
      return true;
    });
  }

  async resultsBetween(first: Day, last: Day): Promise<(PoojaResult & { day: Day })[]> {
    const rows = await this.db
      .select()
      .from(poojaResults)
      .where(between(poojaResults.day, first, last))
      .orderBy(asc(poojaResults.day), asc(poojaResults.studentId));
    return rows.map((row) => ({
      day: row.day,
      studentId: row.studentId,
      status: row.status as FinalStatus,
      firstPunchAt: row.firstPunchAt?.getTime() ?? null,
      excludedAt: row.excludedAt?.getTime() ?? null,
    }));
  }

  async notifiedStudentIds(day: Day): Promise<string[]> {
    const prefix = dedupeKeyOf(day, '');
    const rows = await this.db
      .select({ dedupeKey: outboxEmails.dedupeKey })
      .from(outboxEmails)
      .where(like(outboxEmails.dedupeKey, `${prefix}%`))
      .orderBy(asc(outboxEmails.id));
    return rows.map((row) => row.dedupeKey.slice(prefix.length));
  }

  sendNotifications(
    day: Day,
    excludedStudentIds: string[],
    notifications: Notification[],
    at: Instant,
    doneBy: string,
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      const doneAt = new Date(at);
      if (excludedStudentIds.length > 0) {
        const excluded = await tx
          .update(poojaResults)
          .set({ excludedAt: doneAt })
          .where(
            and(
              eq(poojaResults.day, day),
              inArray(poojaResults.studentId, excludedStudentIds),
              isNull(poojaResults.excludedAt),
            ),
          )
          .returning({ studentId: poojaResults.studentId });
        for (const { studentId } of excluded) {
          await tx.insert(auditLog).values({ action: 'Exclude', studentId, doneAt, doneBy });
        }
      }
      const queued =
        notifications.length === 0
          ? []
          : await tx
              .insert(outboxEmails)
              .values(
                notifications.map((one) => ({
                  kind: 'Notification',
                  recipient: one.recipient,
                  subject: one.subject,
                  body: one.body,
                  dedupeKey: dedupeKeyOf(day, one.studentId),
                  sendAfter: doneAt,
                })),
              )
              .onConflictDoNothing()
              .returning({ id: outboxEmails.id });
      await tx.insert(auditLog).values({ action: 'Send Notifications', doneAt, doneBy });
      return queued.length;
    });
  }
}
