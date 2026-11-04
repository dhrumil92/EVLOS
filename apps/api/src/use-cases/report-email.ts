import type { Instant } from '@evlos/core';
import type { Attachment } from '../ports/notifier.js';
import type { EmailKind, OutgoingEmail } from '../ports/outbox-repository.js';

export interface ReportEmail {
  kind: EmailKind;
  // What the email is about, such as a Day or a month. Part of its dedupe key.
  about: string;
  subject: string;
  body: string;
  attachment: Attachment | null;
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
