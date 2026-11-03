import { dayOf } from './day.js';
import type { Day } from './day.js';
import { isInPoojaWindow } from './pooja-window.js';
import type { Punch } from './punch.js';

// Each Active Student with a Punch inside the Pooja Window of the Day counts once.
// A Punch from an unknown or Deactivated Student ID is kept but never counted (FR-2).
export function studentsPresent(
  punches: readonly Punch[],
  day: Day,
  activeStudentIds: ReadonlySet<string>,
): number {
  const counted = punches.filter(
    ({ studentId, punchedAt }) =>
      activeStudentIds.has(studentId) && dayOf(punchedAt) === day && isInPoojaWindow(punchedAt),
  );
  return new Set(counted.map((punch) => punch.studentId)).size;
}
