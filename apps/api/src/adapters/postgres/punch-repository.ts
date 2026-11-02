import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { punches } from '../../db/schema.js';
import type { PunchRepository, ReceivedPunch } from '../../ports/punch-repository.js';

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
}
