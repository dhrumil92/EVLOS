import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { deactivateStudent } from './deactivate-and-activate.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { getLiveView } from './get-live-view.js';

const AT_0700_IST = Date.UTC(2026, 11, 9, 1, 30, 0);
const AT_2200_IST = Date.UTC(2026, 11, 9, 16, 30, 0);
const NOW_2300_IST = Date.UTC(2026, 11, 9, 17, 30, 0);
const clock = { now: () => NOW_2300_IST };

const repositoryWith = (punches: Punch[]) => {
  const asked: string[] = [];
  const repository: PunchRepository = {
    record: () => Promise.resolve(true),
    punchesOn: (day) => {
      asked.push(day);
      return Promise.resolve(punches);
    },
    punchesBetween: () => Promise.resolve([]),
    punchesReceivedAfter: () => Promise.resolve([]),
  };
  return { repository, asked };
};

async function withStudents(punches: Punch[]) {
  const { students } = fakeStudentRepository();
  const { repository, asked } = repositoryWith(punches);
  for (const [studentId, name] of [
    ['9001', 'Asha Rao'],
    ['9002', 'Bina Rao'],
  ] as const) {
    await addStudent(
      { studentId, name, room: '101', email: `${studentId}@example.com`, phone: '' },
      { students, clock: { now: () => NOW_2300_IST - 24 * 60 * 60 * 1000 } },
    );
  }
  return { deps: { punches: repository, students, clock }, asked };
}

describe('getLiveView', () => {
  it('reads the Punches of the current IST Day', async () => {
    const { deps, asked } = await withStudents([]);

    const view = await getLiveView(deps);

    expect(view.day).toBe('2026-12-09');
    expect(asked).toEqual(['2026-12-09']);
  });

  it('gives each Punch the Student name and says whether it counts', async () => {
    const { deps } = await withStudents([
      { studentId: '9002', punchedAt: AT_2200_IST },
      { studentId: '9001', punchedAt: AT_0700_IST },
    ]);

    const view = await getLiveView(deps);

    expect(view.punches).toEqual([
      {
        studentId: '9002',
        name: 'Bina Rao',
        punchedAt: AT_2200_IST,
        isCounted: false,
        notCountedBecause: 'outside-pooja-window',
      },
      {
        studentId: '9001',
        name: 'Asha Rao',
        punchedAt: AT_0700_IST,
        isCounted: true,
        notCountedBecause: null,
      },
    ]);
  });

  it('shows but does not count a Punch from an unknown Student ID', async () => {
    const { deps } = await withStudents([{ studentId: '9999', punchedAt: AT_0700_IST }]);

    const view = await getLiveView(deps);

    expect(view.punches[0]).toMatchObject({
      name: null,
      isCounted: false,
      notCountedBecause: 'unknown-student',
    });
    expect(view.studentsPresent).toBe(0);
  });

  it('shows but does not count a Punch from a Deactivated Student', async () => {
    const { deps } = await withStudents([{ studentId: '9002', punchedAt: AT_0700_IST }]);
    await deactivateStudent('9002', 'rector@example.com', deps);

    const view = await getLiveView(deps);

    expect(view.punches[0]).toMatchObject({
      name: 'Bina Rao',
      isCounted: false,
      notCountedBecause: 'not-active',
    });
    expect(view.studentsPresent).toBe(0);
    expect(view.activeStudents).toBe(1);
  });

  it('counts the Students Present so far out of the Active Students', async () => {
    const { deps } = await withStudents([
      { studentId: '9001', punchedAt: AT_0700_IST },
      { studentId: '9001', punchedAt: AT_0700_IST + 60_000 },
    ]);

    const view = await getLiveView(deps);

    expect(view.studentsPresent).toBe(1);
    expect(view.activeStudents).toBe(2);
  });
});
