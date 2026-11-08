import { dayOf } from '@evlos/core';
import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { recordLeave } from './leaves.js';
import { finalizeDay, getReview, sendNotifications } from './review.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const RECTOR = 'rector@example.com';
const DAY = '2026-11-03';

// A Punch with the moment it reached EVLOS, for Punches that arrive after Finalize.
type ArrivedPunch = Punch & { receivedAt: number };

async function setUp(now = ist(3, 23), punches: Punch[] = [], arrived: ArrivedPunch[] = []) {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const finalizeFake = fakeFinalizeRepository();
  const punchRepository: PunchRepository = {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve(punches),
    punchesBetween: () => Promise.resolve(punches),
    punchesReceivedAfter: (day, after) =>
      Promise.resolve(
        arrived
          .filter((one) => one.receivedAt > after && dayOf(one.punchedAt) === day)
          .map(({ studentId, punchedAt }) => ({ studentId, punchedAt })),
      ),
  };
  const deps = {
    students,
    leaves,
    punches: punchRepository,
    finalized: finalizeFake.finalized,
    clock: { now: () => now },
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9002', 'Bina Rao', '205'],
    ['9003', 'Chitra Rao', '310'],
  ] as const) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      { ...deps, clock: { now: () => ist(1, 10) } },
    );
  }
  return { ...finalizeFake, deps };
}

describe('getReview', () => {
  it('lists the Needs Review Students before Finalize', async () => {
    const { deps } = await setUp(ist(3, 23), [{ studentId: '9001', punchedAt: ist(3, 7) }]);

    const review = await getReview(DAY, deps);

    expect(review?.needsReview).toEqual([
      { studentId: '9002', name: 'Bina Rao', room: '205' },
      { studentId: '9003', name: 'Chitra Rao', room: '310' },
    ]);
    expect(review?.canFinalize).toBe(true);
    expect(review?.finalization).toBeNull();
  });

  it('does not offer Finalize before the Pooja Window closes', async () => {
    const { deps } = await setUp(ist(3, 17));

    const review = await getReview(DAY, deps);

    expect(review?.canFinalize).toBe(false);
    expect(review?.needsReview).toEqual([]);
  });

  it('lists past Days not Finalized yet, from the first Day a Student was Active', async () => {
    const { deps } = await setUp();
    await finalizeDay('2026-11-02', RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.notFinalizedDays).toEqual(['2026-11-01', '2026-11-03']);
  });

  it('refuses a Day after today', async () => {
    const { deps } = await setUp();

    expect(await getReview('2026-11-04', deps)).toBeNull();
  });
});

describe('finalizeDay', () => {
  it('makes each Needs Review Student Absent and locks the Day', async () => {
    const { deps, results, finalizations } = await setUp(ist(3, 23), [
      { studentId: '9001', punchedAt: ist(3, 7) },
    ]);
    await recordLeave(
      '9003',
      {
        outDay: DAY,
        outTime: '06:00',
        expectedReturnDay: '2026-11-05',
        expectedReturnTime: '18:00',
      },
      RECTOR,
      deps,
    );

    const result = await finalizeDay(DAY, RECTOR, deps);

    expect(result).toEqual({ outcome: 'finalized', absent: 1 });
    expect(results.map((one) => [one.studentId, one.status, one.firstPunchAt])).toEqual([
      ['9001', 'Present', ist(3, 7)],
      ['9002', 'Absent', null],
      ['9003', 'Not Applicable', null],
    ]);
    expect(finalizations).toEqual([{ day: DAY, finalizedBy: RECTOR, finalizedAt: ist(3, 23) }]);
  });

  it('refuses before the Pooja Window closes', async () => {
    const { deps, finalizations } = await setUp(ist(3, 17));

    const result = await finalizeDay(DAY, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'pooja-window-open' });
    expect(finalizations).toEqual([]);
  });

  it('refuses a second Finalize', async () => {
    const { deps } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    const result = await finalizeDay(DAY, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'already-finalized' });
  });

  it('shows the Absent Students for the email list after Finalize', async () => {
    const { deps } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.finalization).toEqual({ finalizedBy: RECTOR, finalizedAt: ist(3, 23) });
    expect(review?.absent.map((one) => [one.studentId, one.isExcluded, one.notification])).toEqual([
      ['9001', false, null],
      ['9002', false, null],
      ['9003', false, null],
    ]);
  });

  it('shows whether each Notification is queued, sent or failed', async () => {
    const { deps, queued } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);
    await sendNotifications(DAY, ['9001'], RECTOR, deps);
    for (const one of queued) one.state = one.studentId === '9002' ? 'sent' : 'failed';

    const review = await getReview(DAY, deps);

    expect(review?.absent.map((one) => [one.studentId, one.isExcluded, one.notification])).toEqual([
      ['9001', true, null],
      ['9002', false, 'sent'],
      ['9003', false, 'failed'],
    ]);
  });

  it('marks an Absent Student whose Punch in the Pooja Window arrived after Finalize', async () => {
    // Asha punched at 07:00, but the Device was offline and sent it at 23:10, after Finalize.
    const { deps } = await setUp(
      ist(3, 23),
      [],
      [{ studentId: '9001', punchedAt: ist(3, 7), receivedAt: ist(3, 23, 10) }],
    );
    await finalizeDay(DAY, RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.absent.map((one) => [one.studentId, one.punchAfterFinalize])).toEqual([
      ['9001', ist(3, 7)],
      ['9002', null],
      ['9003', null],
    ]);
  });

  it('gives the earliest Punch After Finalize when there are several', async () => {
    const { deps } = await setUp(
      ist(3, 23),
      [],
      [
        { studentId: '9001', punchedAt: ist(3, 9), receivedAt: ist(3, 23, 10) },
        { studentId: '9001', punchedAt: ist(3, 7), receivedAt: ist(3, 23, 10) },
      ],
    );
    await finalizeDay(DAY, RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.absent[0]?.punchAfterFinalize).toBe(ist(3, 7));
  });

  it('does not mark a Punch outside the Pooja Window that arrived after Finalize', async () => {
    // A Punch at 20:00 never counts toward a Pooja Status (rule 1), so it changes nothing.
    const { deps } = await setUp(
      ist(3, 23),
      [],
      [{ studentId: '9001', punchedAt: ist(3, 20), receivedAt: ist(3, 23, 10) }],
    );
    await finalizeDay(DAY, RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.absent[0]?.punchAfterFinalize).toBeNull();
  });

  it('does not mark a Punch that arrived before Finalize', async () => {
    const { deps } = await setUp(
      ist(3, 23),
      [],
      [{ studentId: '9001', punchedAt: ist(3, 7), receivedAt: ist(3, 22) }],
    );
    await finalizeDay(DAY, RECTOR, deps);

    const review = await getReview(DAY, deps);

    expect(review?.absent[0]?.punchAfterFinalize).toBeNull();
  });
});

describe('sendNotifications', () => {
  it('queues one Notification for each Absent Student who is not Excluded', async () => {
    const { deps, queued, results } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    const result = await sendNotifications(DAY, ['9002'], RECTOR, deps);

    expect(result).toEqual({ outcome: 'queued', queued: 2 });
    expect(queued.map((one) => one.recipient)).toEqual(['9001@example.com', '9003@example.com']);
    expect(results.find((one) => one.studentId === '9002')?.excludedAt).toBe(ist(3, 23));
  });

  it('writes to the Student by name about the Day', async () => {
    const { deps, queued } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    await sendNotifications(DAY, [], RECTOR, deps);

    expect(queued[0]?.subject).toBe('Pooja missed on Tuesday 3 November 2026');
    expect(queued[0]?.body).toMatch(/^Dear Asha Rao,/);
  });

  it('sends a formatted version of the same email, to the Student by name', async () => {
    const { deps, queued } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);

    await sendNotifications(DAY, [], RECTOR, deps);

    expect(queued[0]?.html).toContain('Dear Asha Rao,');
    expect(queued[0]?.html).toContain('Tuesday 3 November 2026');
  });

  it('queues nothing more on a second click', async () => {
    const { deps, queued } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);
    await sendNotifications(DAY, [], RECTOR, deps);

    const again = await sendNotifications(DAY, [], RECTOR, deps);

    expect(again).toEqual({ outcome: 'queued', queued: 0 });
    expect(queued).toHaveLength(3);
  });

  it('does not even ask to queue a Notification already queued', async () => {
    const { deps, asked } = await setUp();
    await finalizeDay(DAY, RECTOR, deps);
    await sendNotifications(DAY, [], RECTOR, deps);

    await sendNotifications(DAY, [], RECTOR, deps);

    expect(asked.map((list) => list.length)).toEqual([3, 0]);
  });

  it('refuses a Day that is not Finalized', async () => {
    const { deps, queued } = await setUp();

    const result = await sendNotifications(DAY, [], RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'not-finalized' });
    expect(queued).toEqual([]);
  });

  it('Excludes only Absent Students, never a Present one', async () => {
    const { deps, results } = await setUp(ist(3, 23), [
      { studentId: '9001', punchedAt: ist(3, 7) },
    ]);
    await finalizeDay(DAY, RECTOR, deps);

    await sendNotifications(DAY, ['9001'], RECTOR, deps);

    expect(results.find((one) => one.studentId === '9001')?.excludedAt).toBeNull();
  });

  it('never notifies a Present Student, even if asked to Exclude nobody', async () => {
    const { deps, queued } = await setUp(ist(3, 23), [{ studentId: '9001', punchedAt: ist(3, 7) }]);
    await finalizeDay(DAY, RECTOR, deps);

    await sendNotifications(DAY, [], RECTOR, deps);

    expect(queued.map((one) => one.studentId)).toEqual(['9002', '9003']);
  });
});
