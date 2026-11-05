import { strFromU8, unzipSync } from 'fflate';
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

// Every <tag> inside <section> of an XML text, in order.
function listOf(xml: string, section: string, tag: string): string[] {
  const inside = new RegExp(`<${section}[^>]*>(.*?)</${section}>`, 's').exec(xml)?.[1] ?? '';
  return inside.match(new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>.*?</${tag}>)`, 'gs')) ?? [];
}

// The fill and text colours Excel shows for one cell, such as D2, read from inside the file.
async function coloursOf(rows: ReportRow[], cell: string) {
  const files = unzipSync(new Uint8Array(await reportXlsx(report(rows))));
  const text = (path: string) => strFromU8(files[path] ?? new Uint8Array());
  const sheet = text('xl/worksheets/sheet1.xml');
  const styles = text('xl/styles.xml');
  const style = Number(new RegExp(`<c r="${cell}"[^>]*?\\ss="(\\d+)"`).exec(sheet)?.[1] ?? 0);
  const format = listOf(styles, 'cellXfs', 'xf')[style] ?? '';
  const idOf = (name: string) => Number(new RegExp(`${name}="(\\d+)"`).exec(format)?.[1] ?? 0);
  const colourIn = (xml: string | undefined, tag: string) =>
    new RegExp(`<${tag} rgb="(?:FF)?([0-9A-F]{6})"`).exec(xml ?? '')?.[1] ?? null;
  return {
    fill: colourIn(listOf(styles, 'fills', 'fill')[idOf('fillId')], 'fgColor'),
    text: colourIn(listOf(styles, 'fonts', 'font')[idOf('fontId')], 'color'),
  };
}

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

  it('colours Present green and Absent red', async () => {
    const rows = [row('9001', 'Asha Rao', '101', ['Present', 'Absent'])];

    expect(await coloursOf(rows, 'D2')).toEqual({ fill: 'C6EFCE', text: '006100' });
    expect(await coloursOf(rows, 'E2')).toEqual({ fill: 'FFC7CE', text: '9C0006' });
  });

  it('colours Needs Review yellow, as on the page', async () => {
    const rows = [row('9001', 'Asha Rao', '101', ['Needs Review', 'Present'])];

    expect(await coloursOf(rows, 'D2')).toEqual({ fill: 'FFEB9C', text: '9C5700' });
  });

  it('shows Not Applicable and Pending in grey, with no fill', async () => {
    const rows = [row('9001', 'Asha Rao', '101', ['Not Applicable', 'Pending'])];

    expect(await coloursOf(rows, 'D2')).toEqual({ fill: null, text: '808080' });
    expect(await coloursOf(rows, 'E2')).toEqual({ fill: null, text: '808080' });
  });

  it('leaves the Student ID, name and room uncoloured', async () => {
    const rows = [row('9001', 'Asha Rao', '101', ['Present', 'Absent'])];

    expect(await coloursOf(rows, 'B2')).toEqual({ fill: null, text: null });
  });
});
