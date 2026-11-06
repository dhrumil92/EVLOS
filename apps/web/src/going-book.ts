import { dayOf } from './book-day.js';
import type { BookDay } from './book-day.js';
import type { ListedStudent, ManyLeaveRow } from './student-source.js';

// One line copied from the Going-to-Home Book. Dates are YYYY-MM-DD and times HH:MM, in IST.
export interface BookLine {
  key: number;
  room: string;
  student: ListedStudent | null;
  outDay: BookDay;
  pickedOutDay: string;
  outTime: string;
  expectedReturnDay: string;
  expectedReturnTime: string;
  // The number of the line its times were copied from, until one of them is changed.
  copiedFrom: number | null;
  problem: string;
}

export const blankLine = (key: number): BookLine => ({
  key,
  room: '',
  student: null,
  outDay: 'Today',
  pickedOutDay: '',
  outTime: '',
  expectedReturnDay: '',
  expectedReturnTime: '',
  copiedFrom: null,
  problem: '',
});

// A group that left together wrote the same times, so a new line starts with the ones above it.
export const newLineFrom = (above: BookLine, key: number, aboveNumber: number): BookLine => ({
  ...blankLine(key),
  outDay: above.outDay,
  pickedOutDay: above.pickedOutDay,
  outTime: above.outTime,
  expectedReturnDay: above.expectedReturnDay,
  expectedReturnTime: above.expectedReturnTime,
  copiedFrom: aboveNumber,
});

// The book gives the room first, so typing "21" suggests everyone in rooms 210 to 219.
export function studentsInRooms(students: readonly ListedStudent[], typed: string) {
  const digits = typed.trim();
  if (digits === '') return [];
  return students
    .filter((s) => s.isActive && s.room.startsWith(digits))
    .sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
}

export const isAlreadyAway = (line: BookLine) =>
  line.student !== null && line.student.leaveState !== 'In hostel';

export function isReady(line: BookLine) {
  const hasOutDay = line.outDay !== 'Pick a date' || line.pickedOutDay !== '';
  return (
    line.student !== null &&
    !isAlreadyAway(line) &&
    hasOutDay &&
    line.outTime !== '' &&
    line.expectedReturnDay !== '' &&
    line.expectedReturnTime !== ''
  );
}

export function toLeaveRows(lines: readonly BookLine[], today: string): ManyLeaveRow[] {
  return lines.filter(isReady).map((line) => ({
    studentId: line.student?.studentId ?? '',
    outDay: dayOf({ day: line.outDay, pickedDay: line.pickedOutDay }, today),
    outTime: line.outTime,
    expectedReturnDay: line.expectedReturnDay,
    expectedReturnTime: line.expectedReturnTime,
  }));
}
