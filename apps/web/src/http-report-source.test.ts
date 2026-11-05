import { describe, expect, it } from 'vitest';
import { httpReportSource, reportQuery, titleOf } from './http-report-source.js';

describe('http Report source', () => {
  it.each([
    [{ view: 'Day', day: '2026-11-03' }, 'view=Day&day=2026-11-03'],
    [{ view: 'Month', month: '2026-11' }, 'view=Month&month=2026-11'],
    [
      { view: 'Date range', from: '2026-11-01', to: '2026-11-03' },
      'view=Date+range&from=2026-11-01&to=2026-11-03',
    ],
  ] as const)('asks the server for %o', (request, query) => {
    expect(reportQuery(request)).toBe(query);
  });

  it.each([
    [{ view: 'Day', day: '2026-11-03' }, 'Tuesday 3 November 2026'],
    [{ view: 'Month', month: '2026-11' }, 'November 2026'],
    [{ view: 'Date range', from: '2026-11-01', to: '2026-11-03' }, '2026-11-01 to 2026-11-03'],
  ] as const)('titles %o', (request, title) => {
    expect(titleOf(request)).toBe(title);
  });

  it('downloads the CSV of a Report from the same query', () => {
    expect(httpReportSource.csvUrl({ view: 'Month', month: '2026-11' }, 'All')).toBe(
      '/api/reports/csv?view=Month&month=2026-11',
    );
  });

  it('downloads the Excel file of a Report from the same query', () => {
    expect(httpReportSource.xlsxUrl({ view: 'Day', day: '2026-11-03' }, 'All')).toBe(
      '/api/reports/xlsx?view=Day&day=2026-11-03',
    );
  });

  it('asks for only the Students of a chosen Pooja Status', () => {
    expect(httpReportSource.xlsxUrl({ view: 'Month', month: '2026-11' }, 'Not Applicable')).toBe(
      '/api/reports/xlsx?view=Month&month=2026-11&status=Not+Applicable',
    );
  });
});
