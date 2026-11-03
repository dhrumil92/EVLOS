import { describe, expect, it } from 'vitest';
import { dayOf, daysBetween, istInstant, startOfDay } from './day.js';

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

  it('starts a Day at 00:00:00 IST, which is 18:30:00 UTC the evening before', () => {
    const start = startOfDay('2026-11-02');

    expect(start).toBe(utc(2026, 11, 1, 18, 30, 0));
  });

  it('starts 1 January at 00:00:00 IST', () => {
    const start = startOfDay('2027-01-01');

    expect(start).toBe(utc(2026, 12, 31, 18, 30, 0));
  });

  it('starts 29 February in a leap year', () => {
    const start = startOfDay('2028-02-29');

    expect(start).toBe(utc(2028, 2, 28, 18, 30, 0));
  });

  it('starts 1 March the day after 29 February', () => {
    const start = startOfDay('2028-03-01');

    expect(start).toBe(utc(2028, 2, 29, 18, 30, 0));
  });
});

describe('istInstant', () => {
  it('turns a Day and an IST time into the exact instant', () => {
    expect(istInstant('2026-11-03', '07:45')).toBe(utc(2026, 11, 3, 2, 15, 0));
  });

  it('keeps an early IST time on its own Day, though UTC is still the day before', () => {
    expect(istInstant('2026-11-03', '00:30')).toBe(utc(2026, 11, 2, 19, 0, 0));
  });

  it('accepts the last minute of a Day', () => {
    expect(istInstant('2026-11-03', '23:59')).toBe(utc(2026, 11, 3, 18, 29, 0));
  });

  it.each([
    ['a date that does not exist', '2026-02-30', '10:00'],
    ['a badly written date', '3/11/2026', '10:00'],
    ['an hour past 23', '2026-11-03', '24:00'],
    ['a minute past 59', '2026-11-03', '10:60'],
    ['a badly written time', '2026-11-03', '7:45'],
    ['an empty time', '2026-11-03', ''],
  ])('refuses %s', (_kind, day, time) => {
    expect(istInstant(day, time)).toBeNull();
  });
});

describe('daysBetween', () => {
  it('lists every Day from the first to the last, both included', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('gives one Day when both are the same', () => {
    expect(daysBetween('2026-11-03', '2026-11-03')).toEqual(['2026-11-03']);
  });

  it('gives no Days when the first is after the last', () => {
    expect(daysBetween('2026-11-04', '2026-11-03')).toEqual([]);
  });

  it('includes 29 February in a leap year', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toHaveLength(3);
  });
});
