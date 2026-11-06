import type { ListedStudent, ManyLeaveRow } from './student-source.js';

// One line copied from the Going-to-Home Book. Dates are YYYY-MM-DD and times HH:MM, in IST.
export type OutDay = 'Today' | 'Yesterday' | 'Pick a date';

export interface BookLine {
  key: number;
  room: string;
  student: ListedStudent | null;
  outDay: OutDay;
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar arithmetic on the date alone, so the computer's own time zone never matters.
export const dayBefore = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

function outDayOf(line: BookLine, today: string) {
  if (line.outDay === 'Today') return today;
  if (line.outDay === 'Yesterday') return dayBefore(today);
  return line.pickedOutDay;
}

export function toLeaveRows(lines: readonly BookLine[], today: string): ManyLeaveRow[] {
  return lines.filter(isReady).map((line) => ({
    studentId: line.student?.studentId ?? '',
    outDay: outDayOf(line, today),
    outTime: line.outTime,
    expectedReturnDay: line.expectedReturnDay,
    expectedReturnTime: line.expectedReturnTime,
  }));
}
