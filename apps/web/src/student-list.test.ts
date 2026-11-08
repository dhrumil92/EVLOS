import { describe, expect, it } from 'vitest';
import { groupCounts, inGroup, ticked, visibleStudents } from './student-list.js';
import type { LeaveState, ListedStudent } from './student-source.js';

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
  floor: Number(room.charAt(0)),
  leaveState,
  openLeave: null,
});

const ASHA = student('9001', 'Asha Rao', '109');
const BINA = student('9002', 'Bina Rao', '201', 'Away');
const CHITRA = student('9003', 'Chitra Rao', '205', 'Due Back');
const DEEPA = student('9004', 'Deepa Rao', '110', 'In hostel', false);
const ALL = [ASHA, BINA, CHITRA, DEEPA];

const choices = {
  group: 'All Active' as const,
  search: '',
  floor: null,
  sort: 'Room' as const,
};

describe('the filter buttons', () => {
  it('counts each group: Away includes Due Back, and Deactivated is apart from the rest', () => {
    expect(groupCounts(ALL)).toEqual({
      'All Active': 3,
      'In hostel': 1,
      Away: 2,
      'Due Back': 1,
      Deactivated: 1,
    });
  });

  it('puts a Deactivated Student in no group but Deactivated', () => {
    expect(inGroup(DEEPA, 'All Active')).toBe(false);
    expect(inGroup(DEEPA, 'In hostel')).toBe(false);
    expect(inGroup(DEEPA, 'Deactivated')).toBe(true);
  });
});

describe('the Students shown', () => {
  it('shows the chosen group, by room', () => {
    expect(visibleStudents(ALL, choices)).toEqual([ASHA, BINA, CHITRA]);
    expect(visibleStudents(ALL, { ...choices, group: 'Away' })).toEqual([BINA, CHITRA]);
  });

  it('finds a Student by name, Student ID or room', () => {
    expect(visibleStudents(ALL, { ...choices, search: 'bina' })).toEqual([BINA]);
    expect(visibleStudents(ALL, { ...choices, search: '9003' })).toEqual([CHITRA]);
    expect(visibleStudents(ALL, { ...choices, search: '109' })).toEqual([ASHA]);
  });

  it('keeps the floor and the search together, and sorts by name when asked', () => {
    const onFloor2 = { ...choices, floor: 2, sort: 'Name A to Z' as const };

    expect(visibleStudents(ALL, onFloor2)).toEqual([BINA, CHITRA]);
    expect(visibleStudents(ALL, { ...onFloor2, search: 'chitra' })).toEqual([CHITRA]);
  });
});

describe('ticked Students', () => {
  it('a Student in hostel can go on Leave, and an Away or Due Back Student can come back', () => {
    const { canLeave, canReturn } = ticked(ALL, new Set(['9001', '9002', '9003', '9004']));

    expect(canLeave).toEqual([ASHA]);
    expect(canReturn).toEqual([BINA, CHITRA]);
  });
});
