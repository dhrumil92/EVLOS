import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { getPublicLiveView } from './get-public-live-view.js';
import { recordLeave, returnLeave } from './leaves.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const RECTOR = 'rector@example.com';
const TODAY = '2026-11-08';

function fakePunches(punches: Punch[]): PunchRepository {
  return {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve(punches),
    punchesBetween: () => Promise.resolve(punches),
    punchesReceivedAfter: () => Promise.resolve([]),
  };
}

// Four Students, added on 1 November. The clock can be moved.
async function setUp(punches: Punch[] = [], now = ist(8, 12)) {
  const clock = { at: ist(1, 10) };
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const { finalized } = fakeFinalizeRepository();
  const deps = {
    students,
    leaves,
    finalized,
    punches: fakePunches(punches),
    clock: { now: () => clock.at },
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9002', 'Bina Rao', '102'],
    ['9003', 'Chitra Rao', '201'],
    ['9004', 'Deepa Rao', '202'],
  ] as const) {
    await addStudent({ studentId, name, room, email: `${studentId}@example.com`, phone: '' }, deps);
  }
  clock.at = now;
  return { deps, clock };
}

const AWAY_SINCE_6_NOV = {
  outDay: '2026-11-06',
  outTime: '18:00',
  expectedReturnDay: '2026-11-10',
  expectedReturnTime: '18:00',
};

describe('the Public Live View', () => {
  it('counts the Students Present today', async () => {
    const { deps } = await setUp([
      { studentId: '9001', punchedAt: ist(8, 7) },
      { studentId: '9002', punchedAt: ist(8, 9) },
    ]);

    const view = await getPublicLiveView(deps);

    expect(view.day).toBe(TODAY);
    expect(view.present).toBe(2);
  });

  it('expects every Active Student at Pooja when nobody is on a Leave', async () => {
    const { deps } = await setUp();

    expect((await getPublicLiveView(deps)).expected).toBe(4);
  });

  it('does not expect a Student who is Not Applicable today, because a Leave touches the Pooja Window', async () => {
    const { deps } = await setUp();
    await recordLeave('9003', AWAY_SINCE_6_NOV, RECTOR, deps);

    const view = await getPublicLiveView(deps);

    expect(view.expected).toBe(3);
  });

  it('does not expect a Student who came back today after the Pooja Window, as he could not do Pooja', async () => {
    const { deps, clock } = await setUp([], ist(8, 21));
    await recordLeave('9003', AWAY_SINCE_6_NOV, RECTOR, deps);
    await returnLeave('9003', { returnDay: TODAY, returnTime: '19:00' }, RECTOR, deps);
    clock.at = ist(8, 21);

    expect((await getPublicLiveView(deps)).expected).toBe(3);
  });

  it('puts each Present Student in the 15-minute bar of his first Punch, once', async () => {
    const { deps } = await setUp([
      { studentId: '9001', punchedAt: ist(8, 7) },
      { studentId: '9001', punchedAt: ist(8, 7, 20) },
      { studentId: '9002', punchedAt: ist(8, 5, 30) },
    ]);

    const view = await getPublicLiveView(deps);

    expect(view.slots).toHaveLength(50);
    expect(view.slots[0]).toBe(1);
    expect(view.slots[6]).toBe(1);
    expect(view.slots.reduce((sum, count) => sum + count, 0)).toBe(view.present);
  });

  it('leaves out a Punch outside the Pooja Window, and one by a Student ID nobody has', async () => {
    const { deps } = await setUp(
      [
        { studentId: '9001', punchedAt: ist(8, 19) },
        { studentId: '7777', punchedAt: ist(8, 7) },
      ],
      ist(8, 21),
    );

    const view = await getPublicLiveView(deps);

    expect(view.present).toBe(0);
    expect(view.slots.every((count) => count === 0)).toBe(true);
  });

  it('starts the Day at zero, with every bar empty', async () => {
    const { deps } = await setUp([], ist(8, 5));

    const view = await getPublicLiveView(deps);

    expect(view.present).toBe(0);
    expect(view.expected).toBe(4);
    expect(view.slots.every((count) => count === 0)).toBe(true);
  });

  it('says when it was worked out', async () => {
    const { deps } = await setUp([], ist(8, 7, 42));

    expect((await getPublicLiveView(deps)).updatedAt).toBe(ist(8, 7, 42));
  });

  it('holds numbers only: no name, room or Student ID', async () => {
    const { deps } = await setUp([{ studentId: '9001', punchedAt: ist(8, 7) }]);

    const view = await getPublicLiveView(deps);

    expect(Object.keys(view).sort()).toEqual(['day', 'expected', 'present', 'slots', 'updatedAt']);
    expect(JSON.stringify(view)).not.toMatch(/Asha|Rao|9001|101/);
  });
});
