import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeOutbox } from './fake-outbox.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { finalizeDay } from './review.js';
import { queueReviewReminder } from './review-reminder.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const DAY = '2026-11-04';
// 23:00 IST on Wednesday 4 November, when the Review Reminder falls due.
const NOW = ist(4, 23);
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

// Asha punched at 07:00 IST. Chitra (room 310) and Bina (room 205) did not punch and were
// in the hostel, so they are on Needs Review once the Pooja Window closes.
async function setUp(
  punches: Punch[] = [{ studentId: '9001', punchedAt: ist(4, 7) }],
  reportRecipients: string[] = REPORT_RECIPIENTS,
) {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const { finalized } = fakeFinalizeRepository();
  const { outbox, queued } = fakeOutbox();
  const deps = {
    students,
    leaves,
    finalized,
    punches: fakePunches(punches),
    clock: { now: () => NOW },
    outbox,
    reportRecipients,
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9003', 'Chitra Rao', '310'],
    ['9002', 'Bina Rao', '205'],
  ] as const) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      { ...deps, clock: { now: () => ist(1, 10) } },
    );
  }
  return { deps, queued };
}

describe('queueReviewReminder', () => {
  it('lists the Needs Review Students, by room, to each Report Recipient', async () => {
    const { deps, queued } = await setUp();

    const count = await queueReviewReminder(DAY, deps);

    expect(count).toBe(2);
    expect(queued.map((one) => [one.kind, one.recipient, one.dedupeKey, one.sendAfter])).toEqual([
      ['Review Reminder', 'rector@example.com', `Review Reminder|${DAY}|rector@example.com`, NOW],
      ['Review Reminder', 'office@example.com', `Review Reminder|${DAY}|office@example.com`, NOW],
    ]);
    expect(queued[0]?.subject).toBe(
      'Review Reminder: 2 Students on Needs Review for Wednesday 4 November 2026',
    );
    expect(queued[0]?.body).toBe(
      'Wednesday 4 November 2026 is not Finalized yet.\n\n' +
        'These Students had no Punch and were in the hostel for the whole Pooja Window, ' +
        'so they are on Needs Review:\n\n' +
        'Room 205  Bina Rao  (Student ID 9002)\n' +
        'Room 310  Chitra Rao  (Student ID 9003)\n\n' +
        'Check the Leave Notes and both books, record any missing Leaves and Returns, ' +
        'then Finalize the Day on the Review page.\n\n' +
        'EVLOS, hostel Pooja attendance',
    );
    expect(queued[0]?.attachments).toEqual([]);
  });

  it('says Student, not Students, when one Student is on Needs Review', async () => {
    const { deps, queued } = await setUp([
      { studentId: '9001', punchedAt: ist(4, 7) },
      { studentId: '9003', punchedAt: ist(4, 8) },
    ]);

    await queueReviewReminder(DAY, deps);

    expect(queued[0]?.subject).toBe(
      'Review Reminder: 1 Student on Needs Review for Wednesday 4 November 2026',
    );
  });

  it('is not queued once the Day is Finalized', async () => {
    const { deps, queued } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    const count = await queueReviewReminder(DAY, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });

  it('is not queued when no Student is on Needs Review', async () => {
    const { deps, queued } = await setUp([
      { studentId: '9001', punchedAt: ist(4, 7) },
      { studentId: '9002', punchedAt: ist(4, 7) },
      { studentId: '9003', punchedAt: ist(4, 7) },
    ]);

    const count = await queueReviewReminder(DAY, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });

  it('is queued once per Day and address, even when run twice', async () => {
    const { deps, queued } = await setUp();
    await queueReviewReminder(DAY, deps);

    const again = await queueReviewReminder(DAY, deps);

    expect(again).toBe(0);
    expect(queued).toHaveLength(2);
  });

  it('queues nothing when there is no Report Recipient', async () => {
    const { deps, queued } = await setUp(undefined, []);

    const count = await queueReviewReminder(DAY, deps);

    expect(count).toBe(0);
    expect(queued).toEqual([]);
  });
});
