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
  // Saves the new password hash, ends every other session of this Rector (the one with
  // keepTokenHash stays), and writes a Change Password row to the audit log, all at once.
  changePassword(
    rectorId: number,
    passwordHash: string,
    keepTokenHash: string,
    at: Instant,
    doneBy: string,
  ): Promise<void>;
}
