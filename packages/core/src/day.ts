import type { Instant } from './clock.js';

// One calendar date in IST, written YYYY-MM-DD.
export type Day = string;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India has no daylight saving time.

// Milliseconds since 00:00:00 IST on the Day the instant falls on.
export function msIntoDay(instant: Instant): number {
  const msSinceIstEpoch = instant + IST_OFFSET_MS;
  return ((msSinceIstEpoch % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
}

export function dayOf(instant: Instant): Day {
  const daysSince1970InIst = Math.floor((instant + IST_OFFSET_MS) / MS_PER_DAY);
  const { year, month, date } = civilDate(daysSince1970InIst);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

// The instant of 00:00:00 IST on a Day.
export function startOfDay(day: Day): Instant {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return daysSince1970Of(year, month, date) * MS_PER_DAY - IST_OFFSET_MS;
}

// Every Day from first to last, both included. Empty when first is after last.
export function daysBetween(first: Day, last: Day): Day[] {
  const days: Day[] = [];
  // Noon IST, so adding whole days never lands on a Day boundary.
  for (let noon = startOfDay(first) + MS_PER_DAY / 2; dayOf(noon) <= last; noon += MS_PER_DAY) {
    days.push(dayOf(noon));
  }
  return days;
}

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_TEXT = /^([01]\d|2[0-3]):([0-5]\d)$/;

// A Day and an IST time written HH:MM, as in the books, turned into the exact instant.
// Null when either is not a real date or time.
export function istInstant(day: Day, time: string): Instant | null {
  const clock = TIME_TEXT.exec(time);
  if (!DAY_TEXT.test(day) || clock === null) return null;
  const start = startOfDay(day);
  // 2026-02-30 would roll over into March, so it comes back as a different Day.
  if (dayOf(start) !== day) return null;
  return start + (Number(clock[1]) * 60 + Number(clock[2])) * 60 * 1000;
}

// Calendar date to days since 1970-01-01 (Howard Hinnant's days_from_civil).
function daysSince1970Of(year: number, month: number, date: number): number {
  const marchBasedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(marchBasedYear / 400);
  const yearOfEra = marchBasedYear - era * 400;
  const monthFromMarch = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + date - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

// Days since 1970-01-01 to a calendar date (Howard Hinnant's civil_from_days).
// Plain arithmetic, so the core never needs Date.
function civilDate(daysSince1970: number): { year: number; month: number; date: number } {
  const z = daysSince1970 + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153);
  const date = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, date };
}
