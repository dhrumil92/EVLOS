import type { Instant } from '@evlos/core';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, leaves } from '../../db/schema.js';
import type { LeaveRepository, LeaveTimes, StoredLeave } from '../../ports/leave-repository.js';

type LeaveRow = typeof leaves.$inferSelect;

const toLeave = (row: LeaveRow): StoredLeave => ({
  leaveId: row.id,
  studentId: row.studentId,
  outAt: row.outAt.getTime(),
  expectedReturnAt: row.expectedReturnAt.getTime(),
  returnedAt: row.returnedAt?.getTime() ?? null,
});

const notCancelled = isNull(leaves.cancelledAt);

export class PostgresLeaveRepository implements LeaveRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async leavesOf(studentId: string): Promise<StoredLeave[]> {
    const rows = await this.db
      .select()
      .from(leaves)
      .where(and(eq(leaves.studentId, studentId), notCancelled))
      .orderBy(asc(leaves.outAt));
    return rows.map(toLeave);
  }

  async openLeaves(): Promise<StoredLeave[]> {
    const rows = await this.db
      .select()
      .from(leaves)
      .where(and(isNull(leaves.returnedAt), notCancelled))
      .orderBy(asc(leaves.studentId));
    return rows.map(toLeave);
  }

  async leavesBetween(first: Instant, last: Instant): Promise<StoredLeave[]> {
    const rows = await this.db
      .select()
      .from(leaves)
      .where(
        and(
          notCancelled,
          lte(leaves.outAt, new Date(last)),
          or(isNull(leaves.returnedAt), gte(leaves.returnedAt, new Date(first))),
        ),
      )
      .orderBy(asc(leaves.studentId), asc(leaves.outAt));
    return rows.map(toLeave);
  }

  record(studentId: string, times: LeaveTimes, at: Instant, doneBy: string): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.insert(leaves).values({
        studentId,
        outAt: new Date(times.outAt),
        expectedReturnAt: new Date(times.expectedReturnAt),
      });
      await tx
        .insert(auditLog)
        .values({ action: 'Leave', studentId, doneAt: new Date(at), doneBy });
    });
  }

  edit(leave: StoredLeave, times: LeaveTimes, at: Instant, doneBy: string): Promise<void> {
    return this.change(leave, 'Edit Leave', at, doneBy, {
      outAt: new Date(times.outAt),
      expectedReturnAt: new Date(times.expectedReturnAt),
    });
  }

  cancel(leave: StoredLeave, at: Instant, doneBy: string): Promise<void> {
    return this.change(leave, 'Cancel Leave', at, doneBy, { cancelledAt: new Date(at) });
  }

  recordReturn(leave: StoredLeave, returnedAt: Instant, at: Instant, doneBy: string) {
    return this.change(leave, 'Return', at, doneBy, { returnedAt: new Date(returnedAt) });
  }

  // One transaction, so a change is never saved without its audit entry.
  private change(
    leave: StoredLeave,
    action: string,
    at: Instant,
    doneBy: string,
    values: Partial<LeaveRow>,
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.update(leaves).set(values).where(eq(leaves.id, leave.leaveId));
      await tx
        .insert(auditLog)
        .values({ action, studentId: leave.studentId, doneAt: new Date(at), doneBy });
    });
  }
}
