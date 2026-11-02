import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { getLiveView } from './get-live-view.js';

const AT_0700_IST = Date.UTC(2026, 11, 9, 1, 30, 0);
const AT_2200_IST = Date.UTC(2026, 11, 9, 16, 30, 0);
const NOW_2300_IST = Date.UTC(2026, 11, 9, 17, 30, 0);

const repositoryWith = (punches: Punch[]) => {
  const asked: string[] = [];
  const repository: PunchRepository = {
    record: () => Promise.resolve(true),
    punchesOn: (day) => {
      asked.push(day);
      return Promise.resolve(punches);
    },
  };
  return { repository, asked };
};

const clock = { now: () => NOW_2300_IST };

describe('getLiveView', () => {
  it('reads the Punches of the current IST Day', async () => {
    const { repository, asked } = repositoryWith([]);

    const view = await getLiveView({ punches: repository, clock });

    expect(view.day).toBe('2026-12-09');
    expect(asked).toEqual(['2026-12-09']);
  });

  it('marks a Punch inside the Pooja Window as counted and one outside as not', async () => {
    const { repository } = repositoryWith([
      { studentId: '9002', punchedAt: AT_2200_IST },
      { studentId: '9001', punchedAt: AT_0700_IST },
    ]);

    const view = await getLiveView({ punches: repository, clock });

    expect(view.punches).toEqual([
      { studentId: '9002', punchedAt: AT_2200_IST, isCounted: false },
      { studentId: '9001', punchedAt: AT_0700_IST, isCounted: true },
    ]);
  });

  it('counts the Students Present so far', async () => {
    const { repository } = repositoryWith([
      { studentId: '9002', punchedAt: AT_2200_IST },
      { studentId: '9001', punchedAt: AT_0700_IST },
    ]);

    const view = await getLiveView({ punches: repository, clock });

    expect(view.studentsPresent).toBe(1);
  });
});
