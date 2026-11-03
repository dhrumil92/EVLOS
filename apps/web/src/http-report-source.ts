import { fetchPage } from './auth-source.js';
import type { Report, ReportRequest, ReportSource } from './report-source.js';

const IST = { timeZone: 'Asia/Kolkata' } as const;
const dayInWords = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthInWords = new Intl.DateTimeFormat('en-GB', { ...IST, month: 'long', year: 'numeric' });

// The Report's title, made here from what was asked; the server sends only the data.
export function titleOf(request: ReportRequest): string {
  if (request.view === 'Day') {
    return dayInWords.format(new Date(`${request.day}T12:00:00+05:30`)).replace(',', '');
  }
  if (request.view === 'Month') {
    return monthInWords.format(new Date(`${request.month}-15T12:00:00+05:30`));
  }
  return `${request.from} to ${request.to}`;
}

export function reportQuery(request: ReportRequest): string {
  const fields: Record<string, string> =
    request.view === 'Day'
      ? { view: request.view, day: request.day }
      : request.view === 'Month'
        ? { view: request.view, month: request.month }
        : { view: request.view, from: request.from, to: request.to };
  return new URLSearchParams(fields).toString();
}

export const httpReportSource: ReportSource = {
  async load(request) {
    const reply = await fetchPage(`/api/reports?${reportQuery(request)}`);
    if (!reply.ok) {
      throw new Error(`The server answered ${String(reply.status)}`);
    }
    return { title: titleOf(request), ...((await reply.json()) as Omit<Report, 'title'>) };
  },
};
