import type { Day } from '@evlos/core';
import type { Attachment } from '../ports/notifier.js';
import type { OutboxRepository } from '../ports/outbox-repository.js';
import { dayInWords } from './day-in-words.js';
import { getReport } from './get-report.js';
import type { GetReportDeps, Report, ReportRequest } from './get-report.js';
import { statusCounts, toEachAddress } from './report-email.js';

export type DailyReportDeps = GetReportDeps & {
  outbox: Pick<OutboxRepository, 'queue'>;
  reportEmailAddresses: readonly string[];
  attachmentOf(request: ReportRequest, report: Report): Attachment;
};

function countsOf(report: Report): string {
  const lines = statusCounts(report);
  return lines.length === 0 ? 'No Student was Active on this Day.' : lines.join('\n');
}

function bodyOf(day: Day, report: Report): string {
  const notFinalized = report.isFinalized
    ? []
    : ['This Day is not Finalized yet, so a Student with no Punch shows Needs Review, not Absent.'];
  return [
    `Daily Report for ${dayInWords(day)}.`,
    countsOf(report),
    ...notFinalized,
    'The full Report is attached as a CSV file.',
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

// The Daily Report (FR-11): queued at 23:30 IST for each address in REPORT_EMAIL, whether or
// not the Day is Finalized, with the Day's Report attached. Queued once per Day and address,
// so running it again queues nothing. Returns how many were queued.
export async function queueDailyReport(day: Day, deps: DailyReportDeps): Promise<number> {
  if (deps.reportEmailAddresses.length === 0) return 0;
  const request: ReportRequest = { view: 'Day', day };
  const report = await getReport(request, deps);
  if (report === null) return 0;
  const email = {
    kind: 'Daily Report' as const,
    about: day,
    subject: `Daily Report: ${dayInWords(day)}${report.isFinalized ? '' : ' (Not Finalized)'}`,
    body: bodyOf(day, report),
    attachment: deps.attachmentOf(request, report),
  };
  return deps.outbox.queue(toEachAddress(deps.reportEmailAddresses, email, deps.clock.now()));
}
