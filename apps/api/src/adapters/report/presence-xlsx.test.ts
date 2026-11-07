import { strFromU8, unzipSync } from 'fflate';
import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { PresenceRow, VidyalayaPresence } from '../../use-cases/get-vidyalaya-presence.js';
import { presenceFileName, presenceXlsx } from './presence-xlsx.js';

const row = (room: string, name: string, states: PresenceRow['states']): PresenceRow => ({
  room,
  name,
  states,
});

const presence = (rows: PresenceRow[]): VidyalayaPresence => ({
  days: ['2026-11-02', '2026-11-03'],
  rows,
});

// The Excel file read back as rows of cells, the way a spreadsheet shows them.
const rowsOf = async (rows: PresenceRow[]) => readSheet(await presenceXlsx(presence(rows)));

const filesOf = async (rows: PresenceRow[]) =>
  unzipSync(new Uint8Array(await presenceXlsx(presence(rows))));
const textOf = (files: Record<string, Uint8Array>, path: string) =>
  strFromU8(files[path] ?? new Uint8Array());

// Every <tag> inside <section> of an XML text, in order.
function listOf(xml: string, section: string, tag: string): string[] {
  const inside = new RegExp(`<${section}[^>]*>(.*?)</${section}>`, 's').exec(xml)?.[1] ?? '';
  return inside.match(new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>.*?</${tag}>)`, 'gs')) ?? [];
}

// The fill and text colours Excel shows for one cell, such as C2, read from inside the file.
async function coloursOf(rows: PresenceRow[], cell: string) {
  const files = await filesOf(rows);
  const sheet = textOf(files, 'xl/worksheets/sheet1.xml');
  const styles = textOf(files, 'xl/styles.xml');
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

describe('presenceXlsx', () => {
  it('starts with Room and Name, one column for each Day, then the two totals', async () => {
    const rows = await rowsOf([]);

    expect(rows).toEqual([
      ['Room', 'Name', '2026-11-02', '2026-11-03', 'Days In hostel', 'Days Away'],
    ]);
  });

  it('has no Student ID column', async () => {
    const rows = await rowsOf([row('101', 'Asha Rao', ['In hostel', 'Away'])]);

    expect(rows[0]).not.toContain('Student ID');
    expect(rows[1]?.[0]).toBe('101');
  });

  it('writes In hostel and Away as words, never Present or Absent', async () => {
    const rows = await rowsOf([row('101', 'Asha Rao', ['In hostel', 'Away'])]);

    expect(rows[1]?.slice(2, 4)).toEqual(['In hostel', 'Away']);
    expect(JSON.stringify(rows)).not.toMatch(/Present|Absent/);
  });

  it('adds the Days In hostel and the Days Away at the end of each row', async () => {
    const rows = await rowsOf([
      row('101', 'Asha Rao', ['In hostel', 'Away']),
      row('102', 'Bina Rao', ['Away', 'Away']),
    ]);

    expect(rows[1]).toEqual(['101', 'Asha Rao', 'In hostel', 'Away', 1, 1]);
    expect(rows[2]).toEqual(['102', 'Bina Rao', 'Away', 'Away', 0, 2]);
  });

  it('leaves the cell empty on a Day the Student was not Active, and does not count it', async () => {
    const rows = await rowsOf([row('101', 'Asha Rao', [null, 'In hostel'])]);

    expect(rows[1]).toEqual(['101', 'Asha Rao', null, 'In hostel', 1, 0]);
  });

  it('keeps the rows in the order they are given: by room, ascending', async () => {
    const rows = await rowsOf([
      row('101', 'A', ['In hostel', 'In hostel']),
      row('110', 'B', ['In hostel', 'In hostel']),
      row('201', 'C', ['In hostel', 'In hostel']),
    ]);

    expect(rows.slice(1).map((one) => one[0])).toEqual(['101', '110', '201']);
  });

  it('colours In hostel green and Away red, as Excel does for Good and Bad', async () => {
    const rows = [row('101', 'Asha Rao', ['In hostel', 'Away'])];

    expect(await coloursOf(rows, 'C2')).toEqual({ fill: 'C6EFCE', text: '006100' });
    expect(await coloursOf(rows, 'D2')).toEqual({ fill: 'FFC7CE', text: '9C0006' });
  });

  it('writes every name as typed, so one that starts like a formula is never run', async () => {
    const rows = await rowsOf([row('0101', '=SUM(1,2)', ['In hostel', 'In hostel'])]);

    expect(rows[1]?.slice(0, 2)).toEqual(['0101', '=SUM(1,2)']);
  });

  it('names the sheet Vidyalaya Presence, and keeps the heading in view while scrolling', async () => {
    const files = await filesOf([]);

    expect(textOf(files, 'xl/workbook.xml')).toContain('name="Vidyalaya Presence"');
    expect(textOf(files, 'xl/worksheets/sheet1.xml')).toMatch(/ySplit="1"/);
  });
});

describe('presenceFileName', () => {
  it('is named for the Day', () => {
    expect(presenceFileName({ view: 'Day', day: '2026-11-07' })).toBe(
      'vidyalaya-presence-2026-11-07.xlsx',
    );
  });

  it('is named for the month', () => {
    expect(presenceFileName({ view: 'Month', month: '2026-11' })).toBe(
      'vidyalaya-presence-2026-11.xlsx',
    );
  });
});
