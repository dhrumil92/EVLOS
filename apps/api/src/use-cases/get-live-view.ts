import { dayOf, isInPoojaWindow, studentsPresent } from '@evlos/core';
import type { Clock, Day, Instant } from '@evlos/core';
import type { PunchRepository } from '../ports/punch-repository.js';

export interface LiveViewPunch {
  studentId: string;
  punchedAt: Instant;
  isCounted: boolean;
}

export interface LiveView {
  day: Day;
  studentsPresent: number;
  punches: LiveViewPunch[];
}

export interface GetLiveViewDeps {
  punches: PunchRepository;
  clock: Clock;
}

export async function getLiveView(deps: GetLiveViewDeps): Promise<LiveView> {
  const day = dayOf(deps.clock.now());
  const punches = await deps.punches.punchesOn(day);
  return {
    day,
    studentsPresent: studentsPresent(punches, day),
    punches: punches.map((punch) => ({ ...punch, isCounted: isInPoojaWindow(punch.punchedAt) })),
  };
}
