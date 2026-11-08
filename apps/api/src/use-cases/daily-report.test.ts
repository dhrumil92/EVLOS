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
const REPORT_RECIPIENTS = ['rector@example.com', 'office@example.com'];

function fakePunches(punches: Punch[]): PunchRepository {
  return {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve([]),
    punchesBetween: () => Promise.resolve(punches),
    punchesReceivedAfter: () => Promise.resolve([]),
  };
}

// Asha punched at 07:00 IST; Bina did not punch and was in the hostel.
async function setUp(reportRecipients: string[] = REPORT_RECIPIENTS) {
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
    reportRecipients,
    // The Pooja Excel first, then Vidyalaya Presence as a second Excel file. No CSV.
    attachmentsOf: (request: { view: string }) =>
      Promise.resolve([
        { filename: `${request.view} Report.xlsx`, content: Buffer.from('pooja') },
        { filename: `${request.view} Vidyalaya Presence.xlsx`, content: Buffer.from('presence') },
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
  it('queues the Daily Report for each Report Recipient, with the Pooja Excel and Vidyalaya Presence attached', async () => {
    const { deps, queued } = await setUp();

    const count = await queueDailyReport(DAY, deps);

    expect(count).toBe(2);
    expect(queued.map((one) => [one.kind, one.recipient, one.dedupeKey, one.sendAfter])).toEqual([
      ['Daily Report', 'rector@example.com', `Daily Report|${DAY}|rector@example.com`, NOW],
      ['Daily Report', 'office@example.com', `Daily Report|${DAY}|office@example.com`, NOW],
    ]);
    expect(queued[0]?.attachments).toEqual([
      { filename: 'Day Report.xlsx', content: Buffer.from('pooja') },
      { filename: 'Day Vidyalaya Presence.xlsx', content: Buffer.from('presence') },
    ]);
    expect(queued[0]?.attachments.map((one) => one.filename).join(' ')).not.toMatch(/csv/i);
  });

  it('also queues a formatted version, with the counts and the names of the attached files', async () => {
    const { deps, queued } = await setUp();

    await queueDailyReport(DAY, deps);

    expect(queued[0]?.html).toContain('>Wednesday 4 November 2026<');
    expect(queued[0]?.html).toContain('>Present<');
    expect(queued[0]?.html).toContain('Day Report.xlsx');
    expect(queued[0]?.html).toContain('Day Vidyalaya Presence.xlsx');
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
        'The full Report is attached as an Excel file, with each Pooja Status in colour.\n\n' +
        'Vidyalaya Presence is attached as a second Excel file: who was In hostel and who was ' +
        'Away. It is worked out from the Leaves recorded so far, so it can change if a Leave is ' +
        'recorded later. The Monthly Report has the final one.\n\n' +
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

  it('queues nothing when there is no Report Recipient', async () => {
    const { deps, queued } = await setUp([]);

    const count = await queueDailyReport(DAY, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });
});
