import type { Day } from '@evlos/core';
import { reportEmailHtml } from '../email-templates/report-email.js';
import type { Attachment } from '../ports/notifier.js';
import type { DailyReportDeps } from './daily-report.js';
import { monthInWords } from './day-in-words.js';
import { getReport } from './get-report.js';
import type { Report, ReportRequest } from './get-report.js';
import { fileNames, statusCountList, statusCounts, toEachAddress } from './report-email.js';

// The same Report Recipients, outbox and attachments as the Daily Report.
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

const NO_STUDENT = 'No Student was Active in the month.';
const COUNTS_INTRO = 'Pooja Statuses in the month, one for each Student on each Day:';

// The sentences after the counts. Both the plain text and the HTML version say these.
const sentencesOf = (report: Report): string[] => [
  finalizedLine(report),
  'The full Report is attached as an Excel file, with each Pooja Status in colour.',
  'Vidyalaya Presence for the month is attached as a second Excel file: who was In hostel and ' +
    'who was Away on each Day. It is worked out from the Leaves recorded so far.',
];

function bodyOf(month: string, report: Report): string {
  const counts = statusCounts(report);
  return [
    `Monthly Report for ${monthInWords(month)}.`,
    counts.length === 0 ? NO_STUDENT : [COUNTS_INTRO, ...counts].join('\n'),
    ...sentencesOf(report),
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

function htmlOf(month: string, report: Report, attachments: readonly Attachment[]): string {
  return reportEmailHtml({
    title: 'Monthly Report',
    about: monthInWords(month),
    intro: COUNTS_INTRO,
    counts: statusCountList(report),
    emptyText: NO_STUDENT,
    paragraphs: sentencesOf(report),
    files: fileNames(attachments),
  });
}

// The Monthly Report (FR-12): queued at 09:00 IST on the 1st for the previous month, for each
// Report Recipient, with the month's Report and Vidyalaya Presence attached as Excel. Queued once per
// month and address, so running it again queues nothing. Returns how many were queued.
export async function queueMonthlyReport(month: string, deps: MonthlyReportDeps): Promise<number> {
  if (deps.reportRecipients.length === 0) return 0;
  const request: ReportRequest = { view: 'Month', month };
  const report = await getReport(request, deps);
  if (report === null) return 0;
  const attachments = await deps.attachmentsOf(request, report);
  const email = {
    kind: 'Monthly Report' as const,
    about: month,
    subject: `Monthly Report: ${monthInWords(month)}`,
    body: bodyOf(month, report),
    html: htmlOf(month, report, attachments),
    attachments,
  };
  return deps.outbox.queue(toEachAddress(deps.reportRecipients, email, deps.clock.now()));
}
