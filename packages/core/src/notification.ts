import { PoojaStatus } from './pooja-status.js';

export interface StudentStatus {
  studentId: string;
  poojaStatus: PoojaStatus;
}

export interface FinalizedList {
  isFinalized: boolean;
  statuses: readonly StudentStatus[];
  excludedStudentIds: readonly string[];
  notifiedStudentIds: readonly string[];
}

// Who gets a Notification when the Rector clicks Send Notifications: each Absent Student
// on a Finalized Day, at most once, never an Excluded Student.
export function studentsToNotify(list: FinalizedList): string[] {
  if (!list.isFinalized) {
    return [];
  }
  const skipped = new Set([...list.excludedStudentIds, ...list.notifiedStudentIds]);
  const absentStudentIds = list.statuses
    .filter((status) => status.poojaStatus === PoojaStatus.ABSENT)
    .map((status) => status.studentId)
    .filter((studentId) => !skipped.has(studentId));
  return [...new Set(absentStudentIds)];
}
