import type { Instant } from './clock.js';
import { dayOf, startOfDay } from './day.js';
import type { Day } from './day.js';

export type ScheduledEmail =
  | { kind: 'Review Reminder'; day: Day; at: Instant }
  | { kind: 'Daily Report'; day: Day; at: Instant }
  | { kind: 'Monthly Report'; month: string; at: Instant };

const MS_PER_MINUTE = 60 * 1000;

const istTime = (day: Day, hour: number, minute: number): Instant =>
  startOfDay(day) + (hour * 60 + minute) * MS_PER_MINUTE;

// The month before the one a Day falls in, written YYYY-MM.
function monthBefore(day: Day): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (month === 1) return `${String(year - 1)}-12`;
  return `${day.slice(0, 4)}-${String(month - 1).padStart(2, '0')}`;
}

// Every scheduled email of a Day, in time order: the Monthly Report at 09:00 IST on the 1st
// (FR-12), the Review Reminder at 23:00 IST (FR-10), the Daily Report at 23:30 IST (FR-11).
function scheduleOf(day: Day): ScheduledEmail[] {
  const monthly: ScheduledEmail[] = day.endsWith('-01')
    ? [{ kind: 'Monthly Report', month: monthBefore(day), at: istTime(day, 9, 0) }]
    : [];
  return [
    ...monthly,
    { kind: 'Review Reminder', day, at: istTime(day, 23, 0) },
    { kind: 'Daily Report', day, at: istTime(day, 23, 30) },
  ];
}

// The scheduled emails that fell due after the last run and up to now. Only the current
// IST Day counts: an email missed earlier today, while the server was off, is caught up;
// one from the Day before never is. lastRun is null on the server's first run.
export function scheduledEmailsDue(lastRun: Instant | null, now: Instant): ScheduledEmail[] {
  return scheduleOf(dayOf(now)).filter(
    (email) => email.at <= now && (lastRun === null || email.at > lastRun),
  );
}
