import { startOfDay } from '@evlos/core';
import type { Day, Instant, Punch } from '@evlos/core';
import { and, asc, desc, gt, gte, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { punches } from '../../db/schema.js';
import type { PunchRepository, ReceivedPunch } from '../../ports/punch-repository.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class PostgresPunchRepository implements PunchRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async record(punch: ReceivedPunch): Promise<boolean> {
    const inserted = await this.db
      .insert(punches)
      .values({
        deviceSerial: punch.deviceSerial,
        studentId: punch.studentId,
        punchedAt: new Date(punch.punchedAt),
        receivedAt: new Date(punch.receivedAt),
      })
      .onConflictDoNothing()
      .returning({ studentId: punches.studentId });
    return inserted.length > 0;
  }

  async punchesOn(day: Day): Promise<Punch[]> {
    const start = startOfDay(day);
    const rows = await this.db
      .select({ studentId: punches.studentId, punchedAt: punches.punchedAt })
      .from(punches)
      .where(
        and(
          gte(punches.punchedAt, new Date(start)),
          lt(punches.punchedAt, new Date(start + MS_PER_DAY)),
        ),
      )
      .orderBy(desc(punches.punchedAt));
    return rows.map((row) => ({ studentId: row.studentId, punchedAt: row.punchedAt.getTime() }));
  }

  async punchesBetween(first: Day, last: Day): Promise<Punch[]> {
    const rows = await this.db
      .select({ studentId: punches.studentId, punchedAt: punches.punchedAt })
      .from(punches)
      .where(
        and(
          gte(punches.punchedAt, new Date(startOfDay(first))),
          lt(punches.punchedAt, new Date(startOfDay(last) + MS_PER_DAY)),
        ),
      )
      .orderBy(asc(punches.punchedAt));
    return rows.map((row) => ({ studentId: row.studentId, punchedAt: row.punchedAt.getTime() }));
  }

  async punchesReceivedAfter(day: Day, after: Instant): Promise<Punch[]> {
    const start = startOfDay(day);
    const rows = await this.db
      .select({ studentId: punches.studentId, punchedAt: punches.punchedAt })
      .from(punches)
      .where(
        and(
          gte(punches.punchedAt, new Date(start)),
          lt(punches.punchedAt, new Date(start + MS_PER_DAY)),
          gt(punches.receivedAt, new Date(after)),
        ),
      )
      .orderBy(asc(punches.punchedAt));
    return rows.map((row) => ({ studentId: row.studentId, punchedAt: row.punchedAt.getTime() }));
  }
}
