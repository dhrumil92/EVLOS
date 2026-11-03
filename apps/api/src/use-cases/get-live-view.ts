import { dayOf, isActiveOn, isInPoojaWindow, studentsPresent } from '@evlos/core';
import type { Clock, Day, Instant, Punch } from '@evlos/core';
import type { PunchRepository } from '../ports/punch-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';

export type NotCountedBecause = 'unknown-student' | 'not-active' | 'outside-pooja-window';

export interface LiveViewPunch {
  studentId: string;
  // Null for a Student ID that belongs to no Student.
  name: string | null;
  punchedAt: Instant;
  isCounted: boolean;
  notCountedBecause: NotCountedBecause | null;
}

export interface LiveView {
  day: Day;
  studentsPresent: number;
  activeStudents: number;
  punches: LiveViewPunch[];
}

export interface GetLiveViewDeps {
  punches: PunchRepository;
  students: StudentRepository;
  clock: Clock;
}

// Every Punch is shown; only one from an Active Student inside the Pooja Window counts (FR-2).
function reasonNotCounted(punch: Punch, names: Map<string, string>, active: Set<string>) {
  if (!names.has(punch.studentId)) return 'unknown-student';
  if (!active.has(punch.studentId)) return 'not-active';
  return isInPoojaWindow(punch.punchedAt) ? null : 'outside-pooja-window';
}

export async function getLiveView(deps: GetLiveViewDeps): Promise<LiveView> {
  const day = dayOf(deps.clock.now());
  const [punches, students, periods] = await Promise.all([
    deps.punches.punchesOn(day),
    deps.students.list(),
    deps.students.activePeriods(),
  ]);
  const names = new Map(students.map((student) => [student.studentId, student.name]));
  const active = new Set(
    students
      .map((student) => student.studentId)
      .filter((id) =>
        isActiveOn(
          periods.filter((period) => period.studentId === id),
          day,
        ),
      ),
  );
  return {
    day,
    studentsPresent: studentsPresent(punches, day, active),
    activeStudents: active.size,
    punches: punches.map((punch) => {
      const notCountedBecause = reasonNotCounted(punch, names, active);
      return {
        ...punch,
        name: names.get(punch.studentId) ?? null,
        isCounted: notCountedBecause === null,
        notCountedBecause,
      };
    }),
  };
}
