import { describe, expect, it } from 'vitest';
import type { Report, ReportRow } from '../../use-cases/get-report.js';
import { reportCsv } from './report-csv.js';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

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

// The CSV as lines of cells, without the byte order mark.
const linesOf = (csv: string) => csv.slice(1).trimEnd().split('\r\n');

describe('reportCsv', () => {
  it('starts with Student ID, Name, Room and one column for each Day', () => {
    const csv = reportCsv(report([]));

    expect(linesOf(csv)).toEqual(['Student ID,Name,Room,2026-11-02,2026-11-03']);
  });

  it('writes each Pooja Status by its name and Not Applicable as "-"', () => {
    const csv = reportCsv(report([row('9001', 'Asha Rao', '101', ['Present', 'Not Applicable'])]));

    expect(linesOf(csv)[1]).toBe('9001,Asha Rao,101,Present,-');
  });

  it('leaves the cell empty on a Day the Student was not Active', () => {
    const csv = reportCsv(report([row('9001', 'Asha Rao', '101', [null, 'Absent'])]));

    expect(linesOf(csv)[1]).toBe('9001,Asha Rao,101,,Absent');
  });

  it('marks a Day that is not Finalized in its heading, where it shows Needs Review', () => {
    const csv = reportCsv(
      report([row('9001', 'Asha Rao', '101', ['Absent', 'Needs Review'])], [true, false]),
    );

    expect(linesOf(csv)).toEqual([
      'Student ID,Name,Room,2026-11-02,2026-11-03 (Not Finalized)',
      '9001,Asha Rao,101,Absent,Needs Review',
    ]);
  });

  it('lists Students by room, then by name', () => {
    const csv = reportCsv(
      report([
        row('9003', 'Chitra Rao', '310', ['Present', 'Present']),
        row('9002', 'Bina Rao', '101', ['Present', 'Present']),
        row('9001', 'Asha Rao', '101', ['Present', 'Present']),
      ]),
    );

    expect(linesOf(csv).map((line) => line.split(',')[1])).toEqual([
      'Name',
      'Asha Rao',
      'Bina Rao',
      'Chitra Rao',
    ]);
  });

  it('quotes a name that holds a comma or a double quote', () => {
    const csv = reportCsv(report([row('9001', 'Rao, Asha "Ashu"', '101', ['Present', 'Present'])]));

    expect(linesOf(csv)[1]).toBe('9001,"Rao, Asha ""Ashu""",101,Present,Present');
  });

  it('writes a name that starts like a formula as plain text, so a spreadsheet never runs it', () => {
    const csv = reportCsv(
      report([row('9001', '=HYPERLINK("http://x")', '101', ['Present', 'Present'])]),
    );

    expect(linesOf(csv)[1]).toBe('9001,"\'=HYPERLINK(""http://x"")",101,Present,Present');
  });

  it('starts with a byte order mark and ends every line with CRLF, as Excel expects', () => {
    const csv = reportCsv(report([row('9001', 'Asha Rao', '101', ['Present', 'Present'])]));

    expect(csv.startsWith(BYTE_ORDER_MARK)).toBe(true);
    expect(csv.endsWith('Present\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
