import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { Report } from '../../use-cases/get-report.js';
import type { PresenceRequest, VidyalayaPresence } from '../../use-cases/get-vidyalaya-presence.js';
import { reportAttachments } from './report-attachments.js';

const REPORT: Report = {
  isFinalized: true,
  rows: [{ studentId: '9001', name: 'Asha Rao', room: '101', statuses: ['Present'] }],
  hours: null,
  days: null,
  reportDays: [{ day: '2026-11-03', isFinalized: true }],
};

const PRESENCE: VidyalayaPresence = {
  days: ['2026-11-03'],
  rows: [{ room: '101', name: 'Asha Rao', states: ['Away'] }],
};

function attach(presence: VidyalayaPresence | null = PRESENCE) {
  const asked: PresenceRequest[] = [];
  const attachmentsOf = reportAttachments((request) => {
    asked.push(request);
    return Promise.resolve(presence);
  });
  return { attachmentsOf, asked };
}

describe('the files attached to the Daily Report and Monthly Report emails', () => {
  it('are the Pooja Excel first, then Vidyalaya Presence as a second Excel file', async () => {
    const { attachmentsOf } = attach();

    const files = await attachmentsOf({ view: 'Day', day: '2026-11-03' }, REPORT);

    expect(files.map((file) => file.filename)).toEqual([
      'EVLOS Report 2026-11-03.xlsx',
      'vidyalaya-presence-2026-11-03.xlsx',
    ]);
  });

  it('have no CSV', async () => {
    const { attachmentsOf } = attach();

    const files = await attachmentsOf({ view: 'Day', day: '2026-11-03' }, REPORT);

    expect(files.map((file) => file.filename).join(' ')).not.toMatch(/csv/i);
  });

  it('hold the Pooja Statuses in the first file and In hostel or Away in the second', async () => {
    const { attachmentsOf } = attach();

    const [pooja, presence] = await attachmentsOf({ view: 'Day', day: '2026-11-03' }, REPORT);

    expect(await readSheet(pooja?.content as Buffer)).toEqual([
      ['Student ID', 'Name', 'Room', '2026-11-03'],
      ['9001', 'Asha Rao', '101', 'Present'],
    ]);
    expect(await readSheet(presence?.content as Buffer)).toEqual([
      ['Room', 'Name', '2026-11-03', 'Days In hostel', 'Days Away'],
      ['101', 'Asha Rao', 'Away', 0, 1],
    ]);
  });

  it('ask for the same Day, or month, as the Report', async () => {
    const { attachmentsOf, asked } = attach();

    await attachmentsOf({ view: 'Day', day: '2026-11-03' }, REPORT);
    await attachmentsOf({ view: 'Month', month: '2026-11' }, REPORT);

    expect(asked).toEqual([
      { view: 'Day', day: '2026-11-03' },
      { view: 'Month', month: '2026-11' },
    ]);
  });

  it('are named for the month in a Monthly Report', async () => {
    const { attachmentsOf } = attach();

    const files = await attachmentsOf({ view: 'Month', month: '2026-11' }, REPORT);

    expect(files.map((file) => file.filename)).toEqual([
      'EVLOS Report 2026-11.xlsx',
      'vidyalaya-presence-2026-11.xlsx',
    ]);
  });

  it('keep the Pooja Excel and skip Vidyalaya Presence when it cannot be made', async () => {
    const { attachmentsOf } = attach(null);

    const files = await attachmentsOf({ view: 'Day', day: '2026-11-03' }, REPORT);

    expect(files.map((file) => file.filename)).toEqual(['EVLOS Report 2026-11-03.xlsx']);
  });

  it('give a Report for a range of dates only its Pooja Excel, since there is no such Vidyalaya Presence', async () => {
    const { attachmentsOf, asked } = attach();

    const files = await attachmentsOf(
      { view: 'Date range', from: '2026-11-01', to: '2026-11-03' },
      REPORT,
    );

    expect(files).toHaveLength(1);
    expect(asked).toEqual([]);
  });
});
