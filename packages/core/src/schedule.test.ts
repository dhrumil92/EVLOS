import { describe, expect, it } from 'vitest';
import { scheduledEmailsDue } from './schedule.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// An instant given as an IST date and time. month is 1 to 12.
const ist = (year: number, month: number, date: number, hour: number, minute = 0, second = 0) =>
  Date.UTC(year, month - 1, date, hour, minute, second) - IST_OFFSET_MS;
const nov4 = (hour: number, minute = 0, second = 0) => ist(2026, 11, 4, hour, minute, second);

const REVIEW_REMINDER = { kind: 'Review Reminder', day: '2026-11-04', at: nov4(23) };
const DAILY_REPORT = { kind: 'Daily Report', day: '2026-11-04', at: nov4(23, 30) };

describe('scheduled emails, between two runs', () => {
  it('gives the Review Reminder once 23:00 IST has passed', () => {
    expect(scheduledEmailsDue(nov4(22, 59), nov4(23, 0, 30))).toEqual([REVIEW_REMINDER]);
  });

  it('gives the Daily Report at exactly 23:30:00 IST', () => {
    expect(scheduledEmailsDue(nov4(23, 29), nov4(23, 30))).toEqual([DAILY_REPORT]);
  });

  it('never gives the same email again on the next run', () => {
    expect(scheduledEmailsDue(nov4(23, 30), nov4(23, 31))).toEqual([]);
  });

  it('gives nothing when no scheduled time fell between the runs', () => {
    expect(scheduledEmailsDue(nov4(10), nov4(10, 1))).toEqual([]);
  });

  it('reads the times in IST, so the Daily Report falls at 18:00 UTC', () => {
    const lastRun = Date.UTC(2026, 10, 4, 17, 59);
    const now = Date.UTC(2026, 10, 4, 18, 0, 30);

    expect(scheduledEmailsDue(lastRun, now)).toEqual([DAILY_REPORT]);
  });

  it('gives both evening emails, in order, when one run spans them', () => {
    expect(scheduledEmailsDue(nov4(22, 50), nov4(23, 40))).toEqual([REVIEW_REMINDER, DAILY_REPORT]);
  });
});

describe('the Monthly Report', () => {
  it('is given for the previous month at 09:00 IST on the 1st', () => {
    const at = ist(2026, 12, 1, 9);

    expect(scheduledEmailsDue(ist(2026, 12, 1, 8, 59), ist(2026, 12, 1, 9, 0, 30))).toEqual([
      { kind: 'Monthly Report', month: '2026-11', at },
    ]);
  });

  it('is given for December of the year before on 1 January', () => {
    const at = ist(2027, 1, 1, 9);

    expect(scheduledEmailsDue(ist(2027, 1, 1, 8, 59), ist(2027, 1, 1, 9, 1))).toEqual([
      { kind: 'Monthly Report', month: '2026-12', at },
    ]);
  });

  it('is not given at 09:00 IST on any other Day', () => {
    expect(scheduledEmailsDue(nov4(8, 59), nov4(9, 1))).toEqual([]);
  });
});

describe('scheduled emails, when the server starts', () => {
  it('catches up the emails already due earlier the same IST Day', () => {
    expect(scheduledEmailsDue(null, nov4(23, 45))).toEqual([REVIEW_REMINDER, DAILY_REPORT]);
  });

  it('catches up the Monthly Report at any time later on the 1st', () => {
    expect(scheduledEmailsDue(null, ist(2026, 12, 1, 15))).toEqual([
      { kind: 'Monthly Report', month: '2026-11', at: ist(2026, 12, 1, 9) },
    ]);
  });

  it('catches up nothing from the Day before, just after midnight IST', () => {
    expect(scheduledEmailsDue(null, ist(2026, 11, 5, 0, 5))).toEqual([]);
  });

  it('never catches up an email from the Day before, even after a long pause', () => {
    expect(scheduledEmailsDue(nov4(22), ist(2026, 11, 5, 0, 10))).toEqual([]);
  });
});
