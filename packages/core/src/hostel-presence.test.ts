import { describe, expect, it } from 'vitest';
import type { Instant } from './clock.js';
import { isAwayOnDay } from './hostel-presence.js';
import type { Leave } from './leave.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// An instant in November 2026 at the given IST clock time.
const ist = (date: number, hour = 10, minute = 0): Instant =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;

const day = (date: number) => `2026-11-${String(date).padStart(2, '0')}`;

const leave = (outAt: Instant, returnedAt: Instant | null, expectedReturnAt = ist(30)): Leave => ({
  outAt,
  expectedReturnAt,
  returnedAt,
});

// Out on Monday 2 November at 16:30, back on Wednesday 4 November at 18:00.
const MONDAY_TO_WEDNESDAY = leave(ist(2, 16, 30), ist(4, 18, 0));

describe('Vidyalaya Presence: a Student is In hostel or Away on a Day', () => {
  it('is In hostel on a Day with no Leave', () => {
    expect(isAwayOnDay([], day(3))).toBe(false);
  });

  it('is In hostel on the Days before the Leave', () => {
    expect(isAwayOnDay([MONDAY_TO_WEDNESDAY], day(1))).toBe(false);
  });

  it('is Away on the Day of the Out Time, even late in the Day', () => {
    expect(isAwayOnDay([MONDAY_TO_WEDNESDAY], day(2))).toBe(true);
  });

  it('is Away on every Day between the Out Time and the Return Time', () => {
    expect(isAwayOnDay([MONDAY_TO_WEDNESDAY], day(3))).toBe(true);
  });

  it('is In hostel on the Day of the Return Time', () => {
    expect(isAwayOnDay([MONDAY_TO_WEDNESDAY], day(4))).toBe(false);
  });

  it('is In hostel on the Days after the Return Time', () => {
    expect(isAwayOnDay([MONDAY_TO_WEDNESDAY], day(5))).toBe(false);
  });

  it('stays Away on every Day from the Out Time while there is no Return Time', () => {
    const open = leave(ist(2, 16, 30), null);

    expect([1, 2, 3, 8].map((date) => isAwayOnDay([open], day(date)))).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });

  it('stays Away after the Expected Return passes, until the Return Time is recorded', () => {
    const dueBack = leave(ist(2, 16, 30), null, ist(4, 12, 0));

    expect(isAwayOnDay([dueBack], day(6))).toBe(true);
  });

  it('is In hostel on the Return Day even when the Expected Return was a later Day', () => {
    const early = leave(ist(2, 16, 30), ist(3, 9, 0), ist(9, 12, 0));

    expect(isAwayOnDay([early], day(3))).toBe(false);
  });

  it('is In hostel on the Day of a Leave that starts and ends on the same Day', () => {
    // The Return Day wins: he came back that Day.
    expect(isAwayOnDay([leave(ist(2, 16, 30), ist(2, 18, 0))], day(2))).toBe(false);
  });

  it('takes the Day in IST, so an Out Time just after midnight IST is on that Day', () => {
    // 00:10 IST on the 3rd is still the 2nd in UTC.
    const justAfterMidnight = leave(ist(3, 0, 10), ist(5, 10, 0));

    expect(isAwayOnDay([justAfterMidnight], day(2))).toBe(false);
    expect(isAwayOnDay([justAfterMidnight], day(3))).toBe(true);
  });

  it('takes the Return Day in IST, so a Return Time just after midnight IST is on that Day', () => {
    const backAfterMidnight = leave(ist(2, 16, 30), ist(4, 0, 10));

    expect(isAwayOnDay([backAfterMidnight], day(3))).toBe(true);
    expect(isAwayOnDay([backAfterMidnight], day(4))).toBe(false);
  });

  it('is Away on a Day covered by any one of several Leaves', () => {
    const first = leave(ist(2, 16, 30), ist(3, 18, 0));
    const second = leave(ist(10, 9, 0), ist(12, 9, 0));

    expect([2, 3, 6, 10, 11, 12].map((date) => isAwayOnDay([first, second], day(date)))).toEqual([
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
  });
});
