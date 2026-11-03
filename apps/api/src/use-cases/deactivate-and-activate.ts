import { dayOf, isActiveOn } from '@evlos/core';
import type { Clock, Day } from '@evlos/core';
import type { StudentRepository } from '../ports/student-repository.js';

export type DeactivateResult = 'deactivated' | 'not-active' | 'unknown-student';
export type ActivateResult = 'activated' | 'already-active' | 'unknown-student';

export interface ActiveChangeDeps {
  students: StudentRepository;
  clock: Clock;
}

// Null for an unknown Student ID, because every Student has at least one Active period.
async function isActiveToday(studentId: string, today: Day, deps: ActiveChangeDeps) {
  const periods = (await deps.students.activePeriods()).filter((p) => p.studentId === studentId);
  return periods.length === 0 ? null : isActiveOn(periods, today);
}

export async function deactivateStudent(
  studentId: string,
  doneBy: string,
  deps: ActiveChangeDeps,
): Promise<DeactivateResult> {
  const now = deps.clock.now();
  const today = dayOf(now);
  const active = await isActiveToday(studentId, today, deps);
  if (active === null) return 'unknown-student';
  if (!active) return 'not-active';
  await deps.students.deactivate(studentId, today, now, doneBy);
  return 'deactivated';
}

export async function activateStudent(
  studentId: string,
  doneBy: string,
  deps: ActiveChangeDeps,
): Promise<ActivateResult> {
  const now = deps.clock.now();
  const today = dayOf(now);
  const active = await isActiveToday(studentId, today, deps);
  if (active === null) return 'unknown-student';
  if (active) return 'already-active';
  await deps.students.activate(studentId, today, now, doneBy);
  return 'activated';
}
