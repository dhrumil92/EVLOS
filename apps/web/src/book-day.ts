import { dayBefore } from './calendar-day.js';

// The day written in a paper book. The Rector copies the books the same day or the next,
// so Today and Yesterday cover almost every line; any other day is picked. Dates are
// YYYY-MM-DD in IST.
export type BookDay = 'Today' | 'Yesterday' | 'Pick a date';

export const BOOK_DAYS: readonly BookDay[] = ['Today', 'Yesterday', 'Pick a date'];

export function dayOf(when: { day: BookDay; pickedDay: string }, today: string) {
  if (when.day === 'Today') return today;
  if (when.day === 'Yesterday') return dayBefore(today);
  return when.pickedDay;
}
