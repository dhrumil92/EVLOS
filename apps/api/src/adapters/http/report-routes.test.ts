import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Report, ReportRequest } from '../../use-cases/get-report.js';
import { registerReportRoutes } from './report-routes.js';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const REPORT: Report = { isFinalized: false, rows: [], hours: null, days: null, reportDays: [] };

function buildApp(answer: Report | null = REPORT) {
  const asked: ReportRequest[] = [];
  const app = Fastify();
  registerReportRoutes(app, {
    getReport: (request) => {
      asked.push(request);
      return Promise.resolve(answer);
    },
  });
  return { app, asked };
}

describe('Report route', () => {
  it.each([
    ['a Day', 'view=Day&day=2026-11-03', { view: 'Day', day: '2026-11-03' }],
    ['a month', 'view=Month&month=2026-11', { view: 'Month', month: '2026-11' }],
    [
      'a date range',
      'view=Date%20range&from=2026-11-01&to=2026-11-03',
      { view: 'Date range', from: '2026-11-01', to: '2026-11-03' },
    ],
  ])('asks for %s', async (_what, query, request) => {
    const { app, asked } = buildApp();

    const reply = await app.inject({ method: 'GET', url: `/api/reports?${query}` });

    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual(REPORT);
    expect(asked).toEqual([request]);
  });

  it('answers 400 for an unknown view and asks for nothing', async () => {
    const { app, asked } = buildApp();

    const reply = await app.inject({ method: 'GET', url: '/api/reports?view=Year&year=2026' });

    expect(reply.statusCode).toBe(400);
    expect(asked).toEqual([]);
  });

  it('answers 400 when the Report cannot be made, such as a Day after today', async () => {
    const { app } = buildApp(null);

    const reply = await app.inject({ method: 'GET', url: '/api/reports?view=Day&day=2030-01-01' });

    expect(reply.statusCode).toBe(400);
  });
});

describe('Report CSV route', () => {
  it('downloads the Report as a CSV file named after its Day', async () => {
    const { app, asked } = buildApp({
      ...REPORT,
      reportDays: [{ day: '2026-11-03', isFinalized: true }],
    });

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/csv?view=Day&day=2026-11-03',
    });

    expect(reply.statusCode).toBe(200);
    expect(reply.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(reply.headers['content-disposition']).toBe(
      'attachment; filename="EVLOS Report 2026-11-03.csv"',
    );
    expect(reply.body).toBe(`${BYTE_ORDER_MARK}Student ID,Name,Room,2026-11-03\r\n`);
    expect(asked).toEqual([{ view: 'Day', day: '2026-11-03' }]);
  });

  it('answers 400 and sends no file when the Report cannot be made', async () => {
    const { app } = buildApp(null);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/csv?view=Day&day=2030-01-01',
    });

    expect(reply.statusCode).toBe(400);
    expect(reply.headers['content-disposition']).toBeUndefined();
  });
});
