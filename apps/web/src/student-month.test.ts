import { describe, expect, it } from 'vitest';
import type { PoojaStatusName } from './report-source.js';
import { monthAfter, monthBefore, monthCounts, monthGrid, monthInWords } from './student-month.js';

const times = (status: PoojaStatusName, count: number) =>
  Array.from({ length: count }, () => status);

describe('the month of one Student', () => {
  it('has one box for each Day of the month', () => {
    expect(monthGrid('2026-11', [], '2026-11-07').boxes).toHaveLength(30);
    expect(monthGrid('2026-12', [], '2026-12-07').boxes).toHaveLength(31);
  });

  it('counts the 29th of February in a leap year', () => {
    expect(monthGrid('2028-02', [], '2028-02-10').boxes).toHaveLength(29);
    expect(monthGrid('2026-02', [], '2026-02-10').boxes).toHaveLength(28);
  });

  it('starts the weeks on Monday, so the 1st of a Sunday month follows six blank places', () => {
    expect(monthGrid('2026-11', [], '2026-11-07').blanks).toBe(6);
  });

  it('has no blank place when the 1st is a Monday', () => {
    expect(monthGrid('2026-06', [], '2026-06-07').blanks).toBe(0);
  });

  it('gives each Day the Pooja Status the Report has for it, from the 1st', () => {
    const grid = monthGrid('2026-11', ['Present', 'Absent', 'Not Applicable'], '2026-11-07');

    expect(grid.boxes.slice(0, 3).map((box) => [box.day, box.status])).toEqual([
      [1, 'Present'],
      [2, 'Absent'],
      [3, 'Not Applicable'],
    ]);
  });

  it('has no Pooja Status for a Day the Report does not reach, such as a Day after today', () => {
    const grid = monthGrid('2026-11', times('Present', 7), '2026-11-07');

    expect(grid.boxes[7]?.status).toBeNull();
    expect(grid.boxes[29]?.status).toBeNull();
  });

  it('keeps null for a Day the Student was not Active', () => {
    const grid = monthGrid('2026-11', [null, 'Present'], '2026-11-07');

    expect(grid.boxes[0]?.status).toBeNull();
    expect(grid.boxes[1]?.status).toBe('Present');
  });

  it('marks only today, and only in the month that holds today', () => {
    const november = monthGrid('2026-11', [], '2026-11-07').boxes;
    const october = monthGrid('2026-10', [], '2026-11-07').boxes;

    expect(november.filter((box) => box.isToday).map((box) => box.day)).toEqual([7]);
    expect(october.some((box) => box.isToday)).toBe(false);
  });

  it('marks a Day after today as not yet', () => {
    const boxes = monthGrid('2026-11', [], '2026-11-07').boxes;

    expect(boxes[6]?.isFuture).toBe(false);
    expect(boxes[7]?.isFuture).toBe(true);
  });

  it('never marks a Day of an earlier month as not yet', () => {
    expect(monthGrid('2026-10', [], '2026-11-07').boxes.some((box) => box.isFuture)).toBe(false);
  });
});

describe('the count of a month, in words', () => {
  it('names each Pooja Status that occurs, most usual first', () => {
    const statuses = [
      ...times('Present', 18),
      'Absent' as const,
      ...times('Not Applicable', 3),
      'Needs Review' as const,
    ];

    expect(monthCounts(statuses)).toBe('18 Present, 1 Absent, 3 Not Applicable, 1 Needs Review');
  });

  it('leaves out a Pooja Status that does not occur', () => {
    expect(monthCounts(['Present', 'Present'])).toBe('2 Present');
  });

  it('does not count a Day the Student was not Active', () => {
    expect(monthCounts([null, 'Present', null])).toBe('1 Present');
  });

  it('says so when the month has no Pooja Status at all', () => {
    expect(monthCounts([])).toBe('No Pooja Status for this month.');
    expect(monthCounts([null, null])).toBe('No Pooja Status for this month.');
  });
});

describe('stepping between months', () => {
  it('goes to the month before, across the year', () => {
    expect(monthBefore('2026-11')).toBe('2026-10');
    expect(monthBefore('2026-01')).toBe('2025-12');
  });

  it('goes to the month after, across the year', () => {
    expect(monthAfter('2026-11')).toBe('2026-12');
    expect(monthAfter('2026-12')).toBe('2027-01');
  });

  it('names a month in words', () => {
    expect(monthInWords('2026-11')).toBe('November 2026');
  });
});
