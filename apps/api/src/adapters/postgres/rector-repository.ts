import type { Instant } from '@evlos/core';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLog, passwordResets, rectorSessions, rectors } from '../../db/schema.js';
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

  async addPasswordReset(tokenHash: string, rectorId: number, expiresAt: Instant): Promise<void> {
    await this.db
      .insert(passwordResets)
      .values({ tokenHash, rectorId, expiresAt: new Date(expiresAt) });
  }

  // The link is taken in one update that checks it is unused and not expired, so two clicks
  // at once can never both use it. The rest happens in the same transaction, or not at all.
  resetPassword(tokenHash: string, passwordHash: string, at: Instant): Promise<boolean> {
    const when = new Date(at);
    return this.db.transaction(async (tx) => {
      const [link] = await tx
        .update(passwordResets)
        .set({ usedAt: when })
        .where(
          and(
            eq(passwordResets.tokenHash, tokenHash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, when),
          ),
        )
        .returning({ rectorId: passwordResets.rectorId });
      if (link === undefined) return false;
      const [rector] = await tx
        .update(rectors)
        .set({ passwordHash })
        .where(eq(rectors.id, link.rectorId))
        .returning({ email: rectors.email });
      await tx
        .update(passwordResets)
        .set({ usedAt: when })
        .where(and(eq(passwordResets.rectorId, link.rectorId), isNull(passwordResets.usedAt)));
      await tx.delete(rectorSessions).where(eq(rectorSessions.rectorId, link.rectorId));
      await tx
        .insert(auditLog)
        .values({ action: 'Reset Password', doneAt: when, doneBy: rector?.email ?? null });
      return true;
    });
  }
}
