import { dayOf } from './book-day.js';
import type { BookDay } from './book-day.js';
import type { ListedStudent, ManyReturnRow } from './student-source.js';

// When a Student came back, as written in the Back-from-Home Book.
export interface ReturnWhen {
  day: BookDay;
  pickedDay: string;
  time: string;
}

// Soonest Expected Return first. Due Back means expected by tomorrow, so Due Back Students
// always come before the other Away Students.
const byWhoIsExpected = (a: ListedStudent, b: ListedStudent) =>
  (a.openLeave?.expectedReturnAt ?? 0) - (b.openLeave?.expectedReturnAt ?? 0);

// Only a Student who is Away can come back, so the book lists nobody else.
export const awayInOrder = (students: readonly ListedStudent[]) =>
  students
    .filter((student) => student.isActive && student.leaveState !== 'In hostel')
    .sort(byWhoIsExpected);

export function isFound(student: ListedStudent, typed: string) {
  const wanted = typed.trim().toLowerCase();
  return (
    wanted === '' || student.room.startsWith(wanted) || student.name.toLowerCase().includes(wanted)
  );
}

export const hasTime = (when: ReturnWhen) =>
  when.time !== '' && (when.day !== 'Pick a date' || when.pickedDay !== '');

export const toReturnRows = (
  ticked: readonly { student: ListedStudent; when: ReturnWhen }[],
  today: string,
): ManyReturnRow[] =>
  ticked
    .filter(({ when }) => hasTime(when))
    .map(({ student, when }) => ({
      studentId: student.studentId,
      returnDay: dayOf(when, today),
      returnTime: when.time,
    }));
