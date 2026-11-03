import type { FastifyInstance } from 'fastify';
import type { Report, ReportRequest } from '../../use-cases/get-report.js';

export interface ReportRoutesDeps {
  getReport(request: ReportRequest): Promise<Report | null>;
}

type Query = Record<string, string | undefined>;

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
}
