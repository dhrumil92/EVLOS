import { dayOf, isActiveOn, isInPoojaWindow, poojaStatusOf, startOfDay } from '@evlos/core';
import type { ActivePeriod, Clock, Day, Instant, Leave, PoojaStatus, Student } from '@evlos/core';
import type { LeaveRepository } from '../ports/leave-repository.js';
import type { PunchRepository } from '../ports/punch-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';

export type PoojaStatusName = 'Present' | 'Absent' | 'Not Applicable' | 'Pending' | 'Needs Review';

export const STATUS_NAMES: Record<PoojaStatus, PoojaStatusName> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  NOT_APPLICABLE: 'Not Applicable',
  PENDING: 'Pending',
  NEEDS_REVIEW: 'Needs Review',
};

// What a Pooja Status is worked out from, for one Student over the Days asked for.
export interface Evidence {
  student: Student;
  periods: ActivePeriod[];
  punches: Instant[];
  leaves: Leave[];
}

export interface EvidenceDeps {
  students: StudentRepository;
  leaves: LeaveRepository;
  punches: PunchRepository;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function byStudent<T extends { studentId: string }>(items: readonly T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.studentId, [...(map.get(item.studentId) ?? []), item]);
  return map;
}

export async function loadEvidence(first: Day, last: Day, deps: EvidenceDeps): Promise<Evidence[]> {
  const [students, periods, punches, leaves] = await Promise.all([
    deps.students.list(),
    deps.students.activePeriods(),
    deps.punches.punchesBetween(first, last),
    deps.leaves.leavesBetween(startOfDay(first), startOfDay(last) + MS_PER_DAY),
  ]);
  const [periodsOf, punchesOf, leavesOf] = [
    byStudent(periods),
    byStudent(punches),
    byStudent(leaves),
  ];
  return students.map((student) => ({
    student,
    periods: periodsOf.get(student.studentId) ?? [],
    punches: (punchesOf.get(student.studentId) ?? []).map((punch) => punch.punchedAt),
    leaves: leavesOf.get(student.studentId) ?? [],
  }));
}

// Worked out from Punches and Leaves (FR-7). Null on a Day he was not Active: such a Day is
// not evaluated. With isFinalized, Needs Review becomes Absent, as Finalize does.
export function computedStatus(
  day: Day,
  evidence: Evidence,
  clock: Clock,
  isFinalized = false,
): PoojaStatusName | null {
  if (!isActiveOn(evidence.periods, day)) return null;
  const studentDay = { day, punches: evidence.punches, leaves: evidence.leaves, isFinalized };
  return STATUS_NAMES[poojaStatusOf(studentDay, clock)];
}

// The first Punch inside the Pooja Window of the Day, or null.
export function firstPunchOn(day: Day, punches: readonly Instant[]): Instant | null {
  const counted = punches.filter((at) => dayOf(at) === day && isInPoojaWindow(at));
  return counted.length === 0 ? null : Math.min(...counted);
}
