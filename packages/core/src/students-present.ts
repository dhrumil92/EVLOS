import { dayOf } from './day.js';
import type { Day } from './day.js';
import { isInPoojaWindow } from './pooja-window.js';
import type { Punch } from './punch.js';

// Each Student with a Punch inside the Pooja Window of the Day counts once.
export function studentsPresent(punches: readonly Punch[], day: Day): number {
  const counted = punches.filter(
    ({ punchedAt }) => dayOf(punchedAt) === day && isInPoojaWindow(punchedAt),
  );
  return new Set(counted.map((punch) => punch.studentId)).size;
}
