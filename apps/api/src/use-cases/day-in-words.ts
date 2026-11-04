import { startOfDay } from '@evlos/core';
import type { Day } from '@evlos/core';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// A Day as written in an email, such as "Tuesday 3 November 2026". Read at noon IST, so the
// server's own timezone never moves it to another date.
export const dayInWords = (day: Day): string =>
  format.format(startOfDay(day) + MS_PER_DAY / 2).replace(',', '');
