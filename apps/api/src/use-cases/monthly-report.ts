import type { Day } from '@evlos/core';
import type { DailyReportDeps } from './daily-report.js';
import { monthInWords } from './day-in-words.js';
import { getReport } from './get-report.js';
import type { Report, ReportRequest } from './get-report.js';
import { statusCounts, toEachAddress } from './report-email.js';

// The same addresses, outbox and attachment as the Daily Report.
export type MonthlyReportDeps = DailyReportDeps;

// The Days of the month not Finalized on which some Student was Active. A Day before any
// Student was added is left out: there is nothing on it to Finalize.
function notFinalizedDays(report: Report): Day[] {
  return report.reportDays
    .filter(
      (one, index) =>
        !one.isFinalized && report.rows.some((row) => (row.statuses[index] ?? null) !== null),
    )
    .map((one) => one.day);
}

function finalizedLine(report: Report): string {
  const open = notFinalizedDays(report);
  if (open.length === 0) return 'Every Day of the month is Finalized.';
  return (
    `Not Finalized: ${open.join(', ')}. On a Day that is not Finalized, ` +
    'a Student with no Punch shows Needs Review, not Absent.'
  );
}

function bodyOf(month: string, report: Report): string {
  const counts = statusCounts(report);
  return [
    `Monthly Report for ${monthInWords(month)}.`,
    counts.length === 0
      ? 'No Student was Active in the month.'
      : ['Pooja Statuses in the month, one for each Student on each Day:', ...counts].join('\n'),
    finalizedLine(report),
    'The full Report is attached as a CSV file, one row per Student and one column per Day.',
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

// The Monthly Report (FR-12): queued at 09:00 IST on the 1st for the previous month, for each
// address in REPORT_EMAIL, with the month's Report attached. Queued once per month and
// address, so running it again queues nothing. Returns how many were queued.
export async function queueMonthlyReport(month: string, deps: MonthlyReportDeps): Promise<number> {
  if (deps.reportEmailAddresses.length === 0) return 0;
  const request: ReportRequest = { view: 'Month', month };
  const report = await getReport(request, deps);
  if (report === null) return 0;
  const email = {
    kind: 'Monthly Report' as const,
    about: month,
    subject: `Monthly Report: ${monthInWords(month)}`,
    body: bodyOf(month, report),
    attachment: deps.attachmentOf(request, report),
  };
  return deps.outbox.queue(toEachAddress(deps.reportEmailAddresses, email, deps.clock.now()));
}
