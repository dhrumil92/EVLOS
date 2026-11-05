import type { Instant } from '@evlos/core';
import { and, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, rectorSessions, rectors } from '../../db/schema.js';
import type { Rector, RectorRepository } from '../../ports/rector-repository.js';

export class PostgresRectorRepository implements RectorRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async add(email: string, passwordHash: string): Promise<boolean> {
    const inserted = await this.db
      .insert(rectors)
      .values({ email, passwordHash })
      .onConflictDoNothing()
      .returning({ id: rectors.id });
    return inserted.length > 0;
  }

  async findByEmail(email: string): Promise<{ rector: Rector; passwordHash: string } | null> {
    const [found] = await this.db.select().from(rectors).where(eq(rectors.email, email));
    return found
      ? { rector: { id: found.id, email: found.email }, passwordHash: found.passwordHash }
      : null;
  }

  async addSession(tokenHash: string, rectorId: number, expiresAt: Instant): Promise<void> {
    await this.db
      .insert(rectorSessions)
      .values({ tokenHash, rectorId, expiresAt: new Date(expiresAt) });
  }

  async sessionOf(tokenHash: string): Promise<{ rector: Rector; expiresAt: Instant } | null> {
    const [found] = await this.db
      .select({ id: rectors.id, email: rectors.email, expiresAt: rectorSessions.expiresAt })
      .from(rectorSessions)
      .innerJoin(rectors, eq(rectors.id, rectorSessions.rectorId))
      .where(eq(rectorSessions.tokenHash, tokenHash));
    return found
      ? { rector: { id: found.id, email: found.email }, expiresAt: found.expiresAt.getTime() }
      : null;
  }

  async removeSession(tokenHash: string): Promise<void> {
    await this.db.delete(rectorSessions).where(eq(rectorSessions.tokenHash, tokenHash));
  }

  // The new hash, the ended sessions and the audit row are saved together, or not at all.
  async changePassword(
    rectorId: number,
    passwordHash: string,
    keepTokenHash: string,
    at: Instant,
    doneBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(rectors).set({ passwordHash }).where(eq(rectors.id, rectorId));
      await tx
        .delete(rectorSessions)
        .where(
          and(eq(rectorSessions.rectorId, rectorId), ne(rectorSessions.tokenHash, keepTokenHash)),
        );
      await tx.insert(auditLog).values({ action: 'Change Password', doneAt: new Date(at), doneBy });
    });
  }
}
