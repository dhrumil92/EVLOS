import { describe, expect, it } from 'vitest';
import { dayOf } from './day.js';

const utc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) => Date.UTC(year, month - 1, day, hour, minute, second);

describe('Day', () => {
  it('puts 23:59:59 IST on the same Day', () => {
    const lastSecondOfDayInIst = utc(2026, 11, 1, 18, 29, 59);

    const day = dayOf(lastSecondOfDayInIst);

    expect(day).toBe('2026-11-01');
  });

  it('puts 00:00:00 IST on the next Day', () => {
    const firstSecondOfNextDayInIst = utc(2026, 11, 1, 18, 30, 0);

    const day = dayOf(firstSecondOfNextDayInIst);

    expect(day).toBe('2026-11-02');
  });

  it('rolls over the end of a year at 00:00:00 IST', () => {
    const firstSecondOfNewYearInIst = utc(2026, 12, 31, 18, 30, 0);

    const day = dayOf(firstSecondOfNewYearInIst);

    expect(day).toBe('2027-01-01');
  });

  it('counts 29 February in a leap year', () => {
    const noonInIst = utc(2028, 2, 29, 6, 30, 0);

    const day = dayOf(noonInIst);

    expect(day).toBe('2028-02-29');
  });
});
