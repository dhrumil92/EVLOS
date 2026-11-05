import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { queueDailyReport } from './daily-report.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeOutbox } from './fake-outbox.js';
import { fakeStudentRepository } from './fake-student-repository.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const DAY = '2026-11-04';
// 23:30 IST on Wednesday 4 November, when the Daily Report falls due.
const NOW = ist(4, 23, 30);
const RECTOR = 'rector@example.com';
const ADDRESSES = ['rector@example.com', 'office@example.com'];

function fakePunches(punches: Punch[]): PunchRepository {
  return {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve([]),
    punchesBetween: () => Promise.resolve(punches),
  };
}

// Asha punched at 07:00 IST; Bina did not punch and was in the hostel.
async function setUp(reportEmailAddresses: string[] = ADDRESSES) {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const { finalized } = fakeFinalizeRepository();
  const { outbox, queued } = fakeOutbox();
  const deps = {
    students,
    leaves,
    finalized,
    punches: fakePunches([{ studentId: '9001', punchedAt: ist(4, 7) }]),
    clock: { now: () => NOW },
    outbox,
    reportEmailAddresses,
    attachmentsOf: (request: { view: string }, report: { rows: unknown[] }) =>
      Promise.resolve([
        { filename: `${request.view} Report.xlsx`, content: Buffer.from('xlsx') },
        {
          filename: `${request.view} Report.csv`,
          content: Buffer.from(`${String(report.rows.length)} rows`),
        },
      ]),
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9002', 'Bina Rao', '205'],
  ] as const) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      { ...deps, clock: { now: () => ist(1, 10) } },
    );
  }
  return { deps, queued };
}

describe('queueDailyReport', () => {
  it('queues the Daily Report for each address in REPORT_EMAIL, with the Report attached as Excel and CSV', async () => {
    const { deps, queued } = await setUp();

    const count = await queueDailyReport(DAY, deps);

    expect(count).toBe(2);
    expect(queued.map((one) => [one.kind, one.recipient, one.dedupeKey, one.sendAfter])).toEqual([
      ['Daily Report', 'rector@example.com', `Daily Report|${DAY}|rector@example.com`, NOW],
      ['Daily Report', 'office@example.com', `Daily Report|${DAY}|office@example.com`, NOW],
    ]);
    expect(queued[0]?.attachments).toEqual([
      { filename: 'Day Report.xlsx', content: Buffer.from('xlsx') },
      { filename: 'Day Report.csv', content: Buffer.from('2 rows') },
    ]);
  });

  it('counts Needs Review and says the Day is not Finalized, before Finalize', async () => {
    const { deps, queued } = await setUp();

    await queueDailyReport(DAY, deps);

    expect(queued[0]?.subject).toBe('Daily Report: Wednesday 4 November 2026 (Not Finalized)');
    expect(queued[0]?.body).toBe(
      'Daily Report for Wednesday 4 November 2026.\n\n' +
        'Present: 1\n' +
        'Needs Review: 1\n\n' +
        'This Day is not Finalized yet, so a Student with no Punch shows Needs Review, not Absent.\n\n' +
        'The full Report is attached as an Excel file, with each Pooja Status in colour, ' +
        'and as a CSV file.\n\n' +
        'EVLOS, hostel Pooja attendance',
    );
  });

  it('counts Absent and no longer says Not Finalized once the Day is Finalized', async () => {
    const { deps, queued } = await setUp();
    await deps.finalized.finalize(
      DAY,
      [
        { studentId: '9001', status: 'Present', firstPunchAt: ist(4, 7) },
        { studentId: '9002', status: 'Absent', firstPunchAt: null },
      ],
      NOW,
      RECTOR,
    );

    await queueDailyReport(DAY, deps);

    expect(queued[0]?.subject).toBe('Daily Report: Wednesday 4 November 2026');
    expect(queued[0]?.body).toContain('Present: 1\nAbsent: 1\n');
    expect(queued[0]?.body).not.toContain('Not Finalized');
    expect(queued[0]?.body).not.toContain('Needs Review');
  });

  it('is queued once per Day and address, even when run twice', async () => {
    const { deps, queued } = await setUp();
    await queueDailyReport(DAY, deps);

    const again = await queueDailyReport(DAY, deps);

    expect(again).toBe(0);
    expect(queued).toHaveLength(2);
  });

  it('queues nothing when REPORT_EMAIL has no address', async () => {
    const { deps, queued } = await setUp([]);

    const count = await queueDailyReport(DAY, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });
});
