import type { Instant } from '@evlos/core';
import type { StatusCount } from '../email-templates/report-email.js';
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

// How many Pooja Statuses of each kind the Report has, counting one for each Student on each
// Day. A Pooja Status no Student has is left out.
export function statusCountList(report: Report): StatusCount[] {
  const statuses = report.rows.flatMap((row) => row.statuses);
  return COUNTED.flatMap((name) => {
    const count = statuses.filter((status) => status === name).length;
    return count === 0 ? [] : [{ name, count }];
  });
}

// One line per Pooja Status, such as "Present: 30".
export const statusCounts = (report: Report): string[] =>
  statusCountList(report).map(({ name, count }) => `${name}: ${String(count)}`);

// The names of the files an email carries, in order, for the HTML version to list.
export const fileNames = (attachments: readonly Attachment[]): string[] =>
  attachments.map((file) => file.filename);

export interface ReportEmail {
  kind: EmailKind;
  // What the email is about, such as a Day or a month. Part of its dedupe key.
  about: string;
  subject: string;
  body: string;
  html: string;
  attachments: Attachment[];
}

// One copy of an email for each Report Recipient. The dedupe key is the kind, what
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
