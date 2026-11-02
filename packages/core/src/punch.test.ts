import { describe, expect, it } from 'vitest';
import { uniquePunches } from './punch.js';
import type { Punch } from './punch.js';

const AT_0700 = Date.UTC(2026, 10, 10, 1, 30, 0);
const AT_0701 = Date.UTC(2026, 10, 10, 1, 31, 0);

const punch = (studentId: string, punchedAt: number): Punch => ({ studentId, punchedAt });

describe('the same Punch uploaded twice', () => {
  it('keeps one copy when the same Punch arrives twice', () => {
    const unique = uniquePunches([punch('101', AT_0700), punch('101', AT_0700)]);

    expect(unique).toEqual([punch('101', AT_0700)]);
  });

  it('keeps one copy when the same Punch arrives three times among others', () => {
    const unique = uniquePunches([
      punch('101', AT_0700),
      punch('102', AT_0700),
      punch('101', AT_0700),
      punch('101', AT_0700),
    ]);

    expect(unique).toEqual([punch('101', AT_0700), punch('102', AT_0700)]);
  });

  it('keeps two Punches of one Student at different times', () => {
    const unique = uniquePunches([punch('101', AT_0700), punch('101', AT_0701)]);

    expect(unique).toHaveLength(2);
  });

  it('keeps Punches of two Students at the same time', () => {
    const unique = uniquePunches([punch('101', AT_0700), punch('102', AT_0700)]);

    expect(unique).toHaveLength(2);
  });

  it('does not confuse Student IDs that look alike when joined to a time', () => {
    const unique = uniquePunches([punch('1', 11), punch('11', 1)]);

    expect(unique).toHaveLength(2);
  });

  it('keeps nothing when nothing arrives', () => {
    expect(uniquePunches([])).toEqual([]);
  });
});
