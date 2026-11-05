import { isEmailAddress } from '@evlos/core';
import type { Clock } from '@evlos/core';
import type { ReportRecipientRepository } from '../ports/report-recipient-repository.js';

export type AddReportRecipientResult =
  'added' | 'not-an-email-address' | 'already-a-report-recipient';
export type RemoveReportRecipientResult = 'removed' | 'not-a-report-recipient';

export interface ReportRecipientDeps {
  reportRecipients: ReportRecipientRepository;
  clock: Clock;
}

// An address is kept in lower case, so Office@Example.com and office@example.com are the
// same Report Recipient.
const normal = (email: string) => email.trim().toLowerCase();

// The Report Recipients receive the Review Reminder, Daily Report and Monthly Report.
export function listReportRecipients(deps: ReportRecipientDeps): Promise<string[]> {
  return deps.reportRecipients.list();
}

export async function addReportRecipient(
  email: string,
  doneBy: string,
  deps: ReportRecipientDeps,
): Promise<AddReportRecipientResult> {
  const address = normal(email);
  if (!isEmailAddress(address)) return 'not-an-email-address';
  const added = await deps.reportRecipients.add(address, deps.clock.now(), doneBy);
  return added ? 'added' : 'already-a-report-recipient';
}

// The last Report Recipient may be removed too; the Settings page then warns that no one
// receives these emails.
export async function removeReportRecipient(
  email: string,
  doneBy: string,
  deps: ReportRecipientDeps,
): Promise<RemoveReportRecipientResult> {
  const removed = await deps.reportRecipients.remove(normal(email), deps.clock.now(), doneBy);
  return removed ? 'removed' : 'not-a-report-recipient';
}
