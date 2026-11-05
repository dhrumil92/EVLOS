import { describe, expect, it } from 'vitest';
import { reportFileName } from './report-table.js';

describe('reportFileName', () => {
  it.each([
    [{ view: 'Day', day: '2026-11-03' }, 'csv', 'EVLOS Report 2026-11-03.csv'],
    [{ view: 'Month', month: '2026-11' }, 'csv', 'EVLOS Report 2026-11.csv'],
    [
      { view: 'Date range', from: '2026-11-01', to: '2026-11-03' },
      'csv',
      'EVLOS Report 2026-11-01 to 2026-11-03.csv',
    ],
    [{ view: 'Day', day: '2026-11-03' }, 'xlsx', 'EVLOS Report 2026-11-03.xlsx'],
    [{ view: 'Month', month: '2026-11' }, 'xlsx', 'EVLOS Report 2026-11.xlsx'],
  ] as const)('names the file for %o as %s', (request, extension, name) => {
    expect(reportFileName(request, extension)).toBe(name);
  });
});
