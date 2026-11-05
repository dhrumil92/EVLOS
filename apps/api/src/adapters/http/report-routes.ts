import type { FastifyInstance } from 'fastify';
import type { Report, ReportRequest } from '../../use-cases/get-report.js';
import { reportCsv } from '../report/report-csv.js';
import { reportFileName } from '../report/report-table.js';
import { reportXlsx } from '../report/report-xlsx.js';

export interface ReportRoutesDeps {
  getReport(request: ReportRequest): Promise<Report | null>;
}

type Query = Record<string, string | undefined>;

// The file formats a Report downloads as.
const DOWNLOADS = [
  {
    extension: 'csv',
    contentType: 'text/csv; charset=utf-8',
    fileOf: (report: Report): Promise<string | Buffer> => Promise.resolve(reportCsv(report)),
  },
  {
    extension: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileOf: reportXlsx,
  },
] as const;

// The query string as a Report request, or null for an unknown view.
function requestFrom(query: Query): ReportRequest | null {
  const text = (name: string) => query[name] ?? '';
  if (query.view === 'Day') return { view: 'Day', day: text('day') };
  if (query.view === 'Month') return { view: 'Month', month: text('month') };
  if (query.view === 'Date range')
    return { view: 'Date range', from: text('from'), to: text('to') };
  return null;
}

export function registerReportRoutes(app: FastifyInstance, deps: ReportRoutesDeps): void {
  app.get<{ Querystring: Query }>('/api/reports', async (request, reply) => {
    const asked = requestFrom(request.query);
    const report = asked && (await deps.getReport(asked));
    if (!report) {
      return reply.code(400).send({ message: 'This Report cannot be made. Check the dates.' });
    }
    return report;
  });

  // The same Report as a CSV or Excel file to download (FR-11).
  for (const download of DOWNLOADS) {
    app.get<{ Querystring: Query }>(
      `/api/reports/${download.extension}`,
      async (request, reply) => {
        const asked = requestFrom(request.query);
        const report = asked && (await deps.getReport(asked));
        if (!asked || !report) {
          return reply.code(400).send({ message: 'This Report cannot be made. Check the dates.' });
        }
        const fileName = reportFileName(asked, download.extension);
        return reply
          .type(download.contentType)
          .header('Content-Disposition', `attachment; filename="${fileName}"`)
          .send(await download.fileOf(report));
      },
    );
  }
}
