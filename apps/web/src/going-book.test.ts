import { describe, expect, it } from 'vitest';
import {
  blankLine,
  isAlreadyAway,
  isReady,
  newLineFrom,
  studentsInRooms,
  toLeaveRows,
} from './going-book.js';
import type { BookLine } from './going-book.js';
import type { LeaveState, ListedStudent } from './student-source.js';

const TODAY = '2026-11-06';

const student = (
  studentId: string,
  name: string,
  room: string,
  leaveState: LeaveState = 'In hostel',
  isActive = true,
): ListedStudent => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive,
  floor: Number(room[0]),
  leaveState,
  openLeave: leaveState === 'In hostel' ? null : { outAt: 0, expectedReturnAt: 0 },
});

const ASHA = student('9001', 'Asha Rao', '212');
const BINA = student('9002', 'Bina Rao', '213');
const CHITRA = student('9003', 'Chitra Rao', '105');

const filled = (overrides: Partial<BookLine> = {}): BookLine => ({
  ...blankLine(1),
  room: ASHA.room,
  student: ASHA,
  outTime: '16:30',
  expectedReturnDay: '2026-11-08',
  expectedReturnTime: '18:00',
  ...overrides,
});

describe('finding a Student by room', () => {
  it('suggests the Active Students whose room starts with the digits typed', () => {
    const found = studentsInRooms([CHITRA, BINA, ASHA], '21');

    expect(found.map((s) => s.name)).toEqual(['Asha Rao', 'Bina Rao']);
  });

  it('leaves a Deactivated Student out of the suggestions', () => {
    const gone = student('9004', 'Deepa Rao', '214', 'In hostel', false);

    expect(studentsInRooms([ASHA, gone], '21')).toEqual([ASHA]);
  });

  it('suggests nobody before a digit is typed', () => {
    expect(studentsInRooms([ASHA, BINA], '  ')).toEqual([]);
  });
});

describe('a new line', () => {
  it('copies the Out day, Out Time and Expected Return from the line above', () => {
    const above = filled({ outDay: 'Yesterday' });

    const line = newLineFrom(above, 2, 1);

    expect(line).toMatchObject({
      key: 2,
      room: '',
      student: null,
      outDay: 'Yesterday',
      outTime: '16:30',
      expectedReturnDay: '2026-11-08',
      expectedReturnTime: '18:00',
      copiedFrom: 1,
    });
  });
});

describe('a ready line', () => {
  it('has a Student, an Out Time and an Expected Return', () => {
    expect(isReady(filled())).toBe(true);
    expect(isReady(filled({ student: null }))).toBe(false);
    expect(isReady(filled({ outTime: '' }))).toBe(false);
    expect(isReady(filled({ expectedReturnTime: '' }))).toBe(false);
  });

  it('needs the picked date when the Out day is picked', () => {
    expect(isReady(filled({ outDay: 'Pick a date', pickedOutDay: '' }))).toBe(false);
    expect(isReady(filled({ outDay: 'Pick a date', pickedOutDay: '2026-11-01' }))).toBe(true);
  });

  it('is never a line for a Student who is already Away', () => {
    const away = filled({ student: student('9005', 'Esha Rao', '110', 'Due Back') });

    expect(isAlreadyAway(away)).toBe(true);
    expect(isReady(away)).toBe(false);
  });
});

describe('sending the lines', () => {
  it('sends each ready line with its own day and times, and leaves the rest out', () => {
    const lines = [
      filled(),
      filled({ key: 2, student: BINA, outDay: 'Yesterday', outTime: '19:10' }),
      filled({ key: 3, outDay: 'Pick a date', pickedOutDay: '2026-11-02' }),
      filled({ key: 4, student: null }),
    ];

    expect(toLeaveRows(lines, TODAY)).toEqual([
      {
        studentId: '9001',
        outDay: TODAY,
        outTime: '16:30',
        expectedReturnDay: '2026-11-08',
        expectedReturnTime: '18:00',
      },
      {
        studentId: '9002',
        outDay: '2026-11-05',
        outTime: '19:10',
        expectedReturnDay: '2026-11-08',
        expectedReturnTime: '18:00',
      },
      {
        studentId: '9001',
        outDay: '2026-11-02',
        outTime: '16:30',
        expectedReturnDay: '2026-11-08',
        expectedReturnTime: '18:00',
      },
    ]);
  });
});
