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
  // Keeps a password reset link, by the hash of its token, until it expires or is used.
  addPasswordReset(tokenHash: string, rectorId: number, expiresAt: Instant): Promise<void>;
  // Uses the link if, at `at`, it exists, is unused and has not expired: saves the new
  // password hash, closes every open link of the Rector, ends all the Rector's sessions and
  // writes a Reset Password row to the audit log, all at once. Returns false, changing
  // nothing, for any other link.
  resetPassword(tokenHash: string, passwordHash: string, at: Instant): Promise<boolean>;
  // Sets a new password hash from the command line, for a Rector who is locked out: closes
  // every open link of the Rector, ends all the Rector's sessions and writes a Reset Password
  // row to the audit log, all at once. The row has no done_by, since the developer ran it.
  setPassword(rectorId: number, passwordHash: string, at: Instant): Promise<void>;
}
