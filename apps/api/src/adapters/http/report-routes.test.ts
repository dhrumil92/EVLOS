import Fastify from 'fastify';
import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { Report, ReportRequest } from '../../use-cases/get-report.js';
import { registerReportRoutes } from './report-routes.js';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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

describe('Report download for one Pooja Status', () => {
  const MIXED: Report = {
    ...REPORT,
    rows: [
      { studentId: '9001', name: 'Asha Rao', room: '101', statuses: ['Absent'] },
      { studentId: '9002', name: 'Bina Rao', room: '102', statuses: ['Present'] },
      { studentId: '9003', name: 'Chitra Rao', room: '103', statuses: ['Not Applicable'] },
    ],
    reportDays: [{ day: '2026-11-03', isFinalized: true }],
  };

  it('downloads only the Absent Students as Excel, named for them', async () => {
    const { app } = buildApp(MIXED);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/xlsx?view=Day&day=2026-11-03&status=Absent',
    });

    expect(reply.statusCode).toBe(200);
    expect(reply.headers['content-disposition']).toBe(
      'attachment; filename="EVLOS Report 2026-11-03 Absent.xlsx"',
    );
    expect(await readSheet(reply.rawPayload)).toEqual([
      ['Student ID', 'Name', 'Room', '2026-11-03'],
      ['9001', 'Asha Rao', '101', 'Absent'],
    ]);
  });

  it('downloads only the Not Applicable Students as CSV', async () => {
    const { app } = buildApp(MIXED);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/csv?view=Day&day=2026-11-03&status=Not+Applicable',
    });

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBe(
      `${BYTE_ORDER_MARK}Student ID,Name,Room,2026-11-03\r\n9003,Chitra Rao,103,-\r\n`,
    );
  });

  it('answers 400 for a status that is not a Pooja Status, and asks for nothing', async () => {
    const { app, asked } = buildApp(MIXED);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/xlsx?view=Day&day=2026-11-03&status=Late',
    });

    expect(reply.statusCode).toBe(400);
    expect(asked).toEqual([]);
  });
});

describe('Report Excel route', () => {
  it('downloads the Report as an Excel file named after its month', async () => {
    const { app, asked } = buildApp();

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/xlsx?view=Month&month=2026-11',
    });

    expect(reply.statusCode).toBe(200);
    expect(reply.headers['content-type']).toBe(XLSX_TYPE);
    expect(reply.headers['content-disposition']).toBe(
      'attachment; filename="EVLOS Report 2026-11.xlsx"',
    );
    expect(await readSheet(reply.rawPayload)).toEqual([['Student ID', 'Name', 'Room']]);
    expect(asked).toEqual([{ view: 'Month', month: '2026-11' }]);
  });

  it('answers 400 and sends no file when the Report cannot be made', async () => {
    const { app } = buildApp(null);

    const reply = await app.inject({
      method: 'GET',
      url: '/api/reports/xlsx?view=Day&day=2030-01-01',
    });

    expect(reply.statusCode).toBe(400);
    expect(reply.headers['content-disposition']).toBeUndefined();
  });
});
