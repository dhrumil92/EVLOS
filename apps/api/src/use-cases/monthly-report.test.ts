import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeOutbox } from './fake-outbox.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { queueMonthlyReport } from './monthly-report.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// An instant given as an IST date and time. month is 1 to 12.
const ist = (month: number, date: number, hour: number) =>
  Date.UTC(2026, month - 1, date, hour) - IST_OFFSET_MS;
const MONTH = '2026-11';
// 09:00 IST on 1 December, when the Monthly Report for November falls due.
const NOW = ist(12, 1, 9);
const RECTOR = 'rector@example.com';
const REPORT_RECIPIENTS = ['rector@example.com', 'office@example.com'];

function fakePunches(punches: Punch[]): PunchRepository {
  return {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve([]),
    punchesBetween: () => Promise.resolve(punches),
    punchesReceivedAfter: () => Promise.resolve([]),
  };
}

// Asha and Bina are Active from 29 November. Asha punched on both Days; Bina never did and
// was in the hostel. 29 November is Finalized, 30 November is not.
async function setUp(reportRecipients: string[] = REPORT_RECIPIENTS) {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const { finalized } = fakeFinalizeRepository();
  const { outbox, queued } = fakeOutbox();
  const deps = {
    students,
    leaves,
    finalized,
    punches: fakePunches([
      { studentId: '9001', punchedAt: ist(11, 29, 7) },
      { studentId: '9001', punchedAt: ist(11, 30, 7) },
    ]),
    clock: { now: () => NOW },
    outbox,
    reportRecipients,
    // The Pooja Excel first, then Vidyalaya Presence as a second Excel file. No CSV.
    attachmentsOf: (request: object) =>
      Promise.resolve([
        { filename: `${JSON.stringify(request)}.xlsx`, content: Buffer.from('pooja') },
        { filename: `${JSON.stringify(request)} presence.xlsx`, content: Buffer.from('presence') },
      ]),
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9002', 'Bina Rao', '205'],
  ] as const) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      { ...deps, clock: { now: () => ist(11, 29, 10) } },
    );
  }
  await finalized.finalize(
    '2026-11-29',
    [
      { studentId: '9001', status: 'Present', firstPunchAt: ist(11, 29, 7) },
      { studentId: '9002', status: 'Absent', firstPunchAt: null },
    ],
    NOW,
    RECTOR,
  );
  return { deps, queued };
}

describe('queueMonthlyReport', () => {
  it('queues the month for each Report Recipient, with the Pooja Excel and Vidyalaya Presence attached', async () => {
    const { deps, queued } = await setUp();

    const count = await queueMonthlyReport(MONTH, deps);

    expect(count).toBe(2);
    expect(queued.map((one) => [one.kind, one.recipient, one.dedupeKey, one.sendAfter])).toEqual([
      ['Monthly Report', 'rector@example.com', `Monthly Report|${MONTH}|rector@example.com`, NOW],
      ['Monthly Report', 'office@example.com', `Monthly Report|${MONTH}|office@example.com`, NOW],
    ]);
    expect(queued[0]?.subject).toBe('Monthly Report: November 2026');
    expect(queued[0]?.attachments).toEqual([
      { filename: '{"view":"Month","month":"2026-11"}.xlsx', content: Buffer.from('pooja') },
      {
        filename: '{"view":"Month","month":"2026-11"} presence.xlsx',
        content: Buffer.from('presence'),
      },
    ]);
    expect(queued[0]?.attachments.map((one) => one.filename).join(' ')).not.toMatch(/csv/i);
  });

  it('counts every Pooja Status of the month and names the Days not Finalized', async () => {
    const { deps, queued } = await setUp();

    await queueMonthlyReport(MONTH, deps);

    expect(queued[0]?.body).toBe(
      'Monthly Report for November 2026.\n\n' +
        'Pooja Statuses in the month, one for each Student on each Day:\n' +
        'Present: 2\n' +
        'Absent: 1\n' +
        'Needs Review: 1\n\n' +
        'Not Finalized: 2026-11-30. On a Day that is not Finalized, a Student with no Punch ' +
        'shows Needs Review, not Absent.\n\n' +
        'The full Report is attached as an Excel file, with each Pooja Status in colour.\n\n' +
        'Vidyalaya Presence for the month is attached as a second Excel file: who was In hostel ' +
        'and who was Away on each Day. It is worked out from the Leaves recorded so far.\n\n' +
        'EVLOS, hostel Pooja attendance',
    );
  });

  it('says every Day is Finalized once they all are', async () => {
    const { deps, queued } = await setUp();
    await deps.finalized.finalize(
      '2026-11-30',
      [
        { studentId: '9001', status: 'Present', firstPunchAt: ist(11, 30, 7) },
        { studentId: '9002', status: 'Absent', firstPunchAt: null },
      ],
      NOW,
      RECTOR,
    );

    await queueMonthlyReport(MONTH, deps);

    expect(queued[0]?.body).toContain(
      'Present: 2\nAbsent: 2\n\nEvery Day of the month is Finalized.',
    );
  });

  it('is queued once per month and address, even when run twice', async () => {
    const { deps, queued } = await setUp();
    await queueMonthlyReport(MONTH, deps);

    const again = await queueMonthlyReport(MONTH, deps);

    expect(again).toBe(0);
    expect(queued).toHaveLength(2);
  });

  it('queues nothing when there is no Report Recipient', async () => {
    const { deps, queued } = await setUp([]);

    const count = await queueMonthlyReport(MONTH, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });
});
