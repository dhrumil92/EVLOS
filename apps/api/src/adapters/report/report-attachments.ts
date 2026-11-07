import type { Attachment } from '../../ports/notifier.js';
import type { Report, ReportRequest } from '../../use-cases/get-report.js';
import type { PresenceRequest, VidyalayaPresence } from '../../use-cases/get-vidyalaya-presence.js';
import { presenceFileName, presenceXlsx } from './presence-xlsx.js';
import { reportFileName } from './report-table.js';
import { reportXlsx } from './report-xlsx.js';

// Vidyalaya Presence has no range of dates, so only a Day or a month has one.
const presenceRequestOf = (request: ReportRequest): PresenceRequest | null =>
  request.view === 'Date range' ? null : request;

// The files attached to the Daily Report and Monthly Report emails: the Pooja Excel first, then
// Vidyalaya Presence as a second Excel file. There is no CSV. If Vidyalaya Presence cannot be
// made, the Pooja Excel is still sent.
export function reportAttachments(
  getPresence: (request: PresenceRequest) => Promise<VidyalayaPresence | null>,
) {
  return async (request: ReportRequest, report: Report): Promise<Attachment[]> => {
    const pooja = {
      filename: reportFileName(request, 'xlsx', null),
      content: await reportXlsx(report),
    };
    const presenceRequest = presenceRequestOf(request);
    const presence = presenceRequest && (await getPresence(presenceRequest));
    if (!presenceRequest || !presence) return [pooja];
    return [
      pooja,
      { filename: presenceFileName(presenceRequest), content: await presenceXlsx(presence) },
    ];
  };
}
