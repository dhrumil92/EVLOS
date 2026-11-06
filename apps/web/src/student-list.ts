import { byName, byRoom } from './report-rows.js';
import type { ListedStudent } from './student-source.js';

// The filter buttons above the Student list. Away includes Due Back, because a Due Back
// Student is still Away (FR-6); a Deactivated Student is in no group but Deactivated.
export const GROUPS = ['All Active', 'In hostel', 'Away', 'Due Back', 'Deactivated'] as const;
export type Group = (typeof GROUPS)[number];

export const SORTS = ['Room', 'Name A to Z'] as const;
export type StudentSort = (typeof SORTS)[number];

export interface ListChoices {
  group: Group;
  search: string;
  floor: number | null;
  sort: StudentSort;
}

export function inGroup(student: ListedStudent, group: Group) {
  if (group === 'Deactivated') return !student.isActive;
  if (!student.isActive) return false;
  if (group === 'In hostel') return student.leaveState === 'In hostel';
  if (group === 'Away') return student.leaveState !== 'In hostel';
  if (group === 'Due Back') return student.leaveState === 'Due Back';
  return true;
}

export const groupCounts = (students: readonly ListedStudent[]) =>
  Object.fromEntries(
    GROUPS.map((group) => [group, students.filter((s) => inGroup(s, group)).length]),
  ) as Record<Group, number>;

export function visibleStudents(students: readonly ListedStudent[], choices: ListChoices) {
  const wanted = choices.search.trim().toLowerCase();
  return students
    .filter((s) => inGroup(s, choices.group))
    .filter((s) => choices.floor === null || s.floor === choices.floor)
    .filter((s) => `${s.name} ${s.studentId} ${s.room}`.toLowerCase().includes(wanted))
    .sort(choices.sort === 'Room' ? byRoom : byName);
}

// Of the ticked Students, who can go on Leave (in hostel) and who can come back (Away), by room
// as on the page, so the book's lines come in the same order.
export function ticked(students: readonly ListedStudent[], ids: ReadonlySet<string>) {
  const chosen = students.filter((s) => s.isActive && ids.has(s.studentId)).sort(byRoom);
  return {
    canLeave: chosen.filter((s) => s.leaveState === 'In hostel'),
    canReturn: chosen.filter((s) => s.leaveState !== 'In hostel'),
  };
}
