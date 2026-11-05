import { describe, expect, it } from 'vitest';
import type { Report } from '../../use-cases/get-report.js';
import { reportFileName, withStatus } from './report-table.js';

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
    expect(reportFileName(request, extension, null)).toBe(name);
  });

  it('adds the Pooja Status to the name of a file that holds only that status', () => {
    const name = reportFileName({ view: 'Month', month: '2026-11' }, 'xlsx', 'Not Applicable');

    expect(name).toBe('EVLOS Report 2026-11 Not Applicable.xlsx');
  });
});

describe('withStatus', () => {
  // Asha was Absent once, Bina was always Present, Chitra was Away once.
  const report: Report = {
    isFinalized: true,
    rows: [
      { studentId: '9001', name: 'Asha Rao', room: '101', statuses: ['Present', 'Absent'] },
      { studentId: '9002', name: 'Bina Rao', room: '102', statuses: ['Present', 'Present'] },
      { studentId: '9003', name: 'Chitra Rao', room: '103', statuses: ['Not Applicable', null] },
    ],
    hours: null,
    days: null,
    reportDays: [
      { day: '2026-11-02', isFinalized: true },
      { day: '2026-11-03', isFinalized: true },
    ],
  };

  it('keeps only the Students with that Pooja Status on at least one Day, with every Day', () => {
    const absent = withStatus(report, 'Absent');

    expect(absent.rows).toEqual([report.rows[0]]);
    expect(absent.reportDays).toEqual(report.reportDays);
  });

  it('keeps a Student whose other Days have another status', () => {
    const present = withStatus(report, 'Present');

    expect(present.rows.map((row) => row.name)).toEqual(['Asha Rao', 'Bina Rao']);
  });

  it('keeps every Student when no Pooja Status is chosen', () => {
    expect(withStatus(report, null)).toEqual(report);
  });
});
