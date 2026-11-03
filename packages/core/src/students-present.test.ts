import { describe, expect, it } from 'vitest';
import type { Punch } from './punch.js';
import { studentsPresent } from './students-present.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY = '2026-11-10';
// The Students Active on DAY.
const ACTIVE = new Set(['9001', '9002']);

const punch = (studentId: string, date: number, hour: number, minute = 0): Punch => ({
  studentId,
  punchedAt: Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS,
});

describe('Students Present so far', () => {
  it('counts each Student with a Punch inside the Pooja Window', () => {
    expect(studentsPresent([punch('9001', 10, 7), punch('9002', 10, 8)], DAY, ACTIVE)).toBe(2);
  });

  it('counts a Student with two Punches once', () => {
    expect(studentsPresent([punch('9001', 10, 7), punch('9001', 10, 9)], DAY, ACTIVE)).toBe(1);
  });

  it('does not count a Punch outside the Pooja Window', () => {
    expect(studentsPresent([punch('9001', 10, 5, 12), punch('9002', 10, 22)], DAY, ACTIVE)).toBe(0);
  });

  it('does not count a Punch from another Day', () => {
    expect(studentsPresent([punch('9001', 9, 7)], DAY, ACTIVE)).toBe(0);
  });

  it('does not count a Punch from a Student ID that is unknown or not Active', () => {
    expect(studentsPresent([punch('9001', 10, 7), punch('9999', 10, 7)], DAY, ACTIVE)).toBe(1);
  });

  it('is zero with no Punches', () => {
    expect(studentsPresent([], DAY, ACTIVE)).toBe(0);
  });
});
