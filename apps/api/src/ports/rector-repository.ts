import type { Instant } from '@evlos/core';

export interface Rector {
  id: number;
  email: string;
}

export interface RectorRepository {
  // Returns false when the email already has an account.
  add(email: string, passwordHash: string): Promise<boolean>;
  // Null for an email with no account.
  findByEmail(email: string): Promise<{ rector: Rector; passwordHash: string } | null>;
  addSession(tokenHash: string, rectorId: number, expiresAt: Instant): Promise<void>;
  // Null for a token hash with no session.
  sessionOf(tokenHash: string): Promise<{ rector: Rector; expiresAt: Instant } | null>;
  removeSession(tokenHash: string): Promise<void>;
}
