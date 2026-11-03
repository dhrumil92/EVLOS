import { dayOf, floorOf, isActiveOn, isAway, isDueBack } from '@evlos/core';
import type { Clock, Leave, Student } from '@evlos/core';
import type { LeaveRepository, LeaveTimes } from '../ports/leave-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';

export type LeaveState = 'In hostel' | 'Away' | 'Due Back';

export type ListedStudent = Student & {
  isActive: boolean;
  floor: number;
  leaveState: LeaveState;
  openLeave: LeaveTimes | null;
};

// Due Back is still Away, so it is checked first (FR-6).
function leaveStateOf(leaves: Leave[], clock: Clock): LeaveState {
  if (isDueBack(leaves, clock)) return 'Due Back';
  return isAway(leaves) ? 'Away' : 'In hostel';
}

export async function listStudents(deps: {
  students: StudentRepository;
  leaves: LeaveRepository;
  clock: Clock;
}): Promise<ListedStudent[]> {
  const today = dayOf(deps.clock.now());
  const [students, periods, openLeaves] = await Promise.all([
    deps.students.list(),
    deps.students.activePeriods(),
    deps.leaves.openLeaves(),
  ]);
  return students.map((student) => {
    const open = openLeaves.filter((leave) => leave.studentId === student.studentId);
    const [first] = open;
    return {
      ...student,
      isActive: isActiveOn(
        periods.filter((period) => period.studentId === student.studentId),
        today,
      ),
      floor: floorOf(student.room),
      leaveState: leaveStateOf(open, deps.clock),
      openLeave: first ? { outAt: first.outAt, expectedReturnAt: first.expectedReturnAt } : null,
    };
  });
}
