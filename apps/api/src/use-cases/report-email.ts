import type { Instant } from '@evlos/core';
import type { Attachment } from '../ports/notifier.js';
import type { EmailKind, OutgoingEmail } from '../ports/outbox-repository.js';
import type { PoojaStatusName, Report } from './get-report.js';

// The order the counts are written in. A Pooja Status no Student has is left out.
const COUNTED: PoojaStatusName[] = [
  'Present',
  'Absent',
  'Needs Review',
  'Pending',
  'Not Applicable',
];

// One line per Pooja Status, such as "Present: 30", counting one for each Student on each
// Day of the Report.
export function statusCounts(report: Report): string[] {
  const statuses = report.rows.flatMap((row) => row.statuses);
  return COUNTED.flatMap((name) => {
    const count = statuses.filter((status) => status === name).length;
    return count === 0 ? [] : [`${name}: ${String(count)}`];
  });
}

export interface ReportEmail {
  kind: EmailKind;
  // What the email is about, such as a Day or a month. Part of its dedupe key.
  about: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}

// One copy of an email for each address in REPORT_EMAIL. The dedupe key is the kind, what
// it is about and the address, so each copy is queued once however often it is asked for.
export function toEachAddress(
  addresses: readonly string[],
  email: ReportEmail,
  sendAfter: Instant,
): OutgoingEmail[] {
  const { about, ...content } = email;
  return addresses.map((recipient) => ({
    ...content,
    recipient,
    dedupeKey: `${email.kind}|${about}|${recipient}`,
    sendAfter,
  }));
}
