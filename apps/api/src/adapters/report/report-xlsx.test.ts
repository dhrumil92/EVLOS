import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { Report, ReportRow } from '../../use-cases/get-report.js';
import { reportXlsx } from './report-xlsx.js';

const row = (studentId: string, name: string, room: string, statuses: ReportRow['statuses']) => ({
  studentId,
  name,
  room,
  statuses,
});

const report = (rows: ReportRow[], finalized = [true, true]): Report => ({
  isFinalized: finalized.every(Boolean),
  rows,
  hours: null,
  days: null,
  reportDays: [
    { day: '2026-11-02', isFinalized: finalized[0] ?? true },
    { day: '2026-11-03', isFinalized: finalized[1] ?? true },
  ],
});

// The Excel file read back as rows of cells, the way a spreadsheet shows them.
const rowsOf = async (rows: ReportRow[], finalized?: boolean[]) =>
  readSheet(await reportXlsx(report(rows, finalized)));

describe('reportXlsx', () => {
  it('starts with Student ID, Name, Room and one column for each Day', async () => {
    const rows = await rowsOf([]);

    expect(rows).toEqual([['Student ID', 'Name', 'Room', '2026-11-02', '2026-11-03']]);
  });

  it('writes each Pooja Status by its name and Not Applicable as "-"', async () => {
    const rows = await rowsOf([row('9001', 'Asha Rao', '101', ['Present', 'Not Applicable'])]);

    expect(rows[1]).toEqual(['9001', 'Asha Rao', '101', 'Present', '-']);
  });

  it('leaves the cell empty on a Day the Student was not Active', async () => {
    const rows = await rowsOf([row('9001', 'Asha Rao', '101', [null, 'Absent'])]);

    expect(rows[1]).toEqual(['9001', 'Asha Rao', '101', null, 'Absent']);
  });

  it('marks a Day that is not Finalized in its heading, where it shows Needs Review', async () => {
    const rows = await rowsOf(
      [row('9001', 'Asha Rao', '101', ['Absent', 'Needs Review'])],
      [true, false],
    );

    expect(rows).toEqual([
      ['Student ID', 'Name', 'Room', '2026-11-02', '2026-11-03 (Not Finalized)'],
      ['9001', 'Asha Rao', '101', 'Absent', 'Needs Review'],
    ]);
  });

  it('lists Students by room, then by name', async () => {
    const rows = await rowsOf([
      row('9003', 'Chitra Rao', '310', ['Present', 'Present']),
      row('9002', 'Bina Rao', '101', ['Present', 'Present']),
      row('9001', 'Asha Rao', '101', ['Present', 'Present']),
    ]);

    expect(rows.map((cells) => cells[1])).toEqual(['Name', 'Asha Rao', 'Bina Rao', 'Chitra Rao']);
  });

  it('keeps a Student ID and room as text, so leading zeros stay', async () => {
    const rows = await rowsOf([row('0042', 'Asha Rao', '007', ['Present', 'Present'])]);

    expect(rows[1]?.slice(0, 3)).toEqual(['0042', 'Asha Rao', '007']);
  });

  it('keeps a name that starts like a formula as text, exactly as typed', async () => {
    const rows = await rowsOf([
      row('9001', '=HYPERLINK("http://x")', '101', ['Present', 'Present']),
    ]);

    expect(rows[1]?.[1]).toBe('=HYPERLINK("http://x")');
  });

  it('keeps a name with &, < or > intact', async () => {
    const rows = await rowsOf([row('9001', 'Asha & <Ashu>', '101', ['Present', 'Present'])]);

    expect(rows[1]?.[1]).toBe('Asha & <Ashu>');
  });
});
