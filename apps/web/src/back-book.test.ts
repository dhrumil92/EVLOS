import { describe, expect, it } from 'vitest';
import { awayInOrder, isFound, toReturnRows } from './back-book.js';
import type { LeaveState, ListedStudent } from './student-source.js';

const TODAY = '2026-11-06';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number) => Date.UTC(2026, 10, date, hour) - IST_OFFSET_MS;

const student = (
  studentId: string,
  name: string,
  room: string,
  leaveState: LeaveState,
  expectedReturnAt = ist(9, 18),
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
  openLeave: leaveState === 'In hostel' ? null : { outAt: ist(4, 16), expectedReturnAt },
});

const ASHA = student('9001', 'Asha Rao', '212', 'Away', ist(9, 18));
const BINA = student('9002', 'Bina Rao', '110', 'Due Back', ist(6, 20));
const CHITRA = student('9003', 'Chitra Rao', '105', 'In hostel');

describe('who is listed in the Back-from-Home Book', () => {
  it('lists only the Active Students who are Away, Due Back first', () => {
    const gone = student('9004', 'Deepa Rao', '118', 'Away', ist(8, 18), false);

    expect(awayInOrder([ASHA, CHITRA, BINA, gone])).toEqual([BINA, ASHA]);
  });

  it('Find matches the start of the room or any part of the name', () => {
    expect(isFound(ASHA, '21')).toBe(true);
    expect(isFound(ASHA, 'rao')).toBe(true);
    expect(isFound(ASHA, '12')).toBe(false);
    expect(isFound(ASHA, '  ')).toBe(true);
  });
});

describe('sending the ticked Returns', () => {
  it('sends each ticked Student with their own day and Return Time, and leaves out lines with no time', () => {
    const rows = toReturnRows(
      [
        { student: ASHA, when: { day: 'Today', pickedDay: '', time: '17:15' } },
        { student: BINA, when: { day: 'Yesterday', pickedDay: '', time: '21:40' } },
        { student: CHITRA, when: { day: 'Today', pickedDay: '', time: '' } },
      ],
      TODAY,
    );

    expect(rows).toEqual([
      { studentId: '9001', returnDay: TODAY, returnTime: '17:15' },
      { studentId: '9002', returnDay: '2026-11-05', returnTime: '21:40' },
    ]);
  });
});
