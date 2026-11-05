import type { Instant } from '@evlos/core';

// The Report Recipients: the email addresses that receive the Review Reminder, Daily Report
// and Monthly Report. Each change is written to the audit log with the address and the email
// of the Rector who made it.
export interface ReportRecipientRepository {
  // In the order they were added.
  list(): Promise<string[]>;
  // Returns false when the address is already a Report Recipient.
  add(email: string, at: Instant, doneBy: string): Promise<boolean>;
  // Returns false when the address is not a Report Recipient.
  remove(email: string, at: Instant, doneBy: string): Promise<boolean>;
}
