import type { Day } from '@evlos/core';
import { reportEmailHtml } from '../email-templates/report-email.js';
import type { Attachment } from '../ports/notifier.js';
import type { OutboxRepository } from '../ports/outbox-repository.js';
import { dayInWords } from './day-in-words.js';
import { getReport } from './get-report.js';
import type { GetReportDeps, Report, ReportRequest } from './get-report.js';
import { fileNames, statusCountList, statusCounts, toEachAddress } from './report-email.js';

export type DailyReportDeps = GetReportDeps & {
  outbox: Pick<OutboxRepository, 'queue'>;
  reportRecipients: readonly string[];
  // The files to attach: the Pooja Excel first, then Vidyalaya Presence as a second Excel file.
  attachmentsOf(request: ReportRequest, report: Report): Promise<Attachment[]>;
};

const NO_STUDENT = 'No Student was Active on this Day.';

// The sentences after the counts. Both the plain text and the HTML version say these.
function sentencesOf(report: Report): string[] {
  const notFinalized = report.isFinalized
    ? []
    : ['This Day is not Finalized yet, so a Student with no Punch shows Needs Review, not Absent.'];
  return [
    ...notFinalized,
    'The full Report is attached as an Excel file, with each Pooja Status in colour.',
    'Vidyalaya Presence is attached as a second Excel file: who was In hostel and who was Away. ' +
      'It is worked out from the Leaves recorded so far, so it can change if a Leave is recorded ' +
      'later. The Monthly Report has the final one.',
  ];
}

function bodyOf(day: Day, report: Report): string {
  const lines = statusCounts(report);
  return [
    `Daily Report for ${dayInWords(day)}.`,
    lines.length === 0 ? NO_STUDENT : lines.join('\n'),
    ...sentencesOf(report),
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

function htmlOf(day: Day, report: Report, attachments: readonly Attachment[]): string {
  return reportEmailHtml({
    title: 'Daily Report',
    about: dayInWords(day),
    intro: null,
    counts: statusCountList(report),
    emptyText: NO_STUDENT,
    paragraphs: sentencesOf(report),
    files: fileNames(attachments),
  });
}

// The Daily Report (FR-11): queued at 23:30 IST for each Report Recipient, whether or
// not the Day is Finalized, with the Day's Report and Vidyalaya Presence attached as Excel. Queued once per
// Day and address, so running it again queues nothing. Returns how many were queued.
export async function queueDailyReport(day: Day, deps: DailyReportDeps): Promise<number> {
  if (deps.reportRecipients.length === 0) return 0;
  const request: ReportRequest = { view: 'Day', day };
  const report = await getReport(request, deps);
  if (report === null) return 0;
  const attachments = await deps.attachmentsOf(request, report);
  const email = {
    kind: 'Daily Report' as const,
    about: day,
    subject: `Daily Report: ${dayInWords(day)}${report.isFinalized ? '' : ' (Not Finalized)'}`,
    body: bodyOf(day, report),
    html: htmlOf(day, report, attachments),
    attachments,
  };
  return deps.outbox.queue(toEachAddress(deps.reportRecipients, email, deps.clock.now()));
}
