import type { Instant } from '@evlos/core';
import type { ReportRecipientRepository } from '../ports/report-recipient-repository.js';

// An in-memory list of Report Recipients for use-case tests, which records the audit rows.
export function fakeReportRecipientRepository(start: string[] = []) {
  const emails = [...start];
  const audit: { action: string; detail: string; doneAt: Instant; doneBy: string }[] = [];
  const reportRecipients: ReportRecipientRepository = {
    list: () => Promise.resolve([...emails]),
    add: (email, at, doneBy) => {
      if (emails.includes(email)) return Promise.resolve(false);
      emails.push(email);
      audit.push({ action: 'Add Report Recipient', detail: email, doneAt: at, doneBy });
      return Promise.resolve(true);
    },
    remove: (email, at, doneBy) => {
      const index = emails.indexOf(email);
      if (index === -1) return Promise.resolve(false);
      emails.splice(index, 1);
      audit.push({ action: 'Remove Report Recipient', detail: email, doneAt: at, doneBy });
      return Promise.resolve(true);
    },
  };
  return { reportRecipients, audit };
}
