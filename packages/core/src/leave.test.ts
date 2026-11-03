import { describe, expect, it } from 'vitest';
import type { Clock, Instant } from './clock.js';
import { isAway, isDueBack, leaveProblem, returnProblem } from './leave.js';
import type { Leave } from './leave.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// An instant in November 2026 at the given IST clock time.
const ist = (date: number, hour = 10, minute = 0, second = 0): Instant =>
  Date.UTC(2026, 10, date, hour, minute, second) - IST_OFFSET_MS;

const clockAt = (instant: Instant): Clock => ({ now: () => instant });

const openLeave = (expectedReturnAt: Instant): Leave => ({
  outAt: ist(1),
  expectedReturnAt,
  returnedAt: null,
});

const closedLeave = (expectedReturnAt: Instant): Leave => ({
  ...openLeave(expectedReturnAt),
  returnedAt: ist(2),
});

describe('Away', () => {
  it('is Away with an open Leave', () => {
    expect(isAway([openLeave(ist(9))])).toBe(true);
  });

  it('is not Away once the Return Time is recorded', () => {
    expect(isAway([closedLeave(ist(9))])).toBe(false);
  });

  it('is not Away with no Leave', () => {
    expect(isAway([])).toBe(false);
  });

  it('is Away when an older Leave is closed and a newer one is open', () => {
    expect(isAway([closedLeave(ist(2)), openLeave(ist(9))])).toBe(true);
  });
});

describe('Due Back', () => {
  const today = clockAt(ist(10));

  it('is Due Back when Expected Return is tomorrow', () => {
    expect(isDueBack([openLeave(ist(11))], today)).toBe(true);
  });

  it('is Due Back when Expected Return is late tomorrow, more than 24 hours away', () => {
    const lateTomorrow = ist(11, 20, 0, 0);

    expect(isDueBack([openLeave(lateTomorrow)], today)).toBe(true);
  });

  it('is Due Back when Expected Return is today', () => {
    expect(isDueBack([openLeave(ist(10))], today)).toBe(true);
  });

  it('stays Due Back after Expected Return has passed', () => {
    expect(isDueBack([openLeave(ist(4))], today)).toBe(true);
  });

  it('is not Due Back when Expected Return is the day after tomorrow', () => {
    expect(isDueBack([openLeave(ist(12))], today)).toBe(false);
  });

  it('is not Due Back once the Return Time is recorded', () => {
    expect(isDueBack([closedLeave(ist(4))], today)).toBe(false);
  });

  it('is not Due Back with no Leave', () => {
    expect(isDueBack([], today)).toBe(false);
  });

  it('judges tomorrow by the IST Day at 23:59:59 IST', () => {
    const lastSecondOfDay = clockAt(ist(10, 23, 59, 59));
    const firstSecondOfDayAfterTomorrow = ist(12, 0, 0, 0);

    expect(isDueBack([openLeave(firstSecondOfDayAfterTomorrow)], lastSecondOfDay)).toBe(false);
  });

  it('judges tomorrow by the IST Day at 00:00:00 IST', () => {
    const firstSecondOfDay = clockAt(ist(11, 0, 0, 0));
    const firstSecondOfTomorrow = ist(12, 0, 0, 0);

    expect(isDueBack([openLeave(firstSecondOfTomorrow)], firstSecondOfDay)).toBe(true);
  });
});

describe('leaveProblem', () => {
  const NOW = ist(3, 21, 0);
  const newLeave = (outAt: Instant, expectedReturnAt = ist(9)) => ({ outAt, expectedReturnAt });

  it('accepts a Leave whose Out Time is days in the past', () => {
    expect(leaveProblem(newLeave(ist(1, 8, 0)), [], NOW)).toBeNull();
  });

  it('accepts an Out Time of exactly now', () => {
    expect(leaveProblem(newLeave(NOW), [], NOW)).toBeNull();
  });

  it('refuses an Out Time later than now', () => {
    expect(leaveProblem(newLeave(NOW + 60_000), [], NOW)).toBe('out-time-in-future');
  });

  it('refuses an Expected Return earlier than the Out Time', () => {
    expect(leaveProblem(newLeave(ist(3, 8, 0), ist(3, 7, 59)), [], NOW)).toBe(
      'expected-return-before-out',
    );
  });

  it('accepts an Expected Return equal to the Out Time', () => {
    expect(leaveProblem(newLeave(ist(3, 8, 0), ist(3, 8, 0)), [], NOW)).toBeNull();
  });

  it('refuses a second Leave while one is open', () => {
    expect(leaveProblem(newLeave(ist(3, 8, 0)), [openLeave(ist(9))], NOW)).toBe('already-away');
  });

  it('refuses a Leave that starts before his last Return Time', () => {
    const earlier = { outAt: ist(1, 8, 0), expectedReturnAt: ist(2), returnedAt: ist(2, 18, 0) };

    expect(leaveProblem(newLeave(ist(2, 17, 0)), [earlier], NOW)).toBe('overlaps-earlier-leave');
  });

  it('accepts a Leave that starts the minute he returned', () => {
    const earlier = { outAt: ist(1, 8, 0), expectedReturnAt: ist(2), returnedAt: ist(2, 18, 0) };

    expect(leaveProblem(newLeave(ist(2, 18, 0)), [earlier], NOW)).toBeNull();
  });
});

describe('returnProblem', () => {
  const NOW = ist(3, 21, 0);
  const away = { outAt: ist(1, 8, 0), expectedReturnAt: ist(3), returnedAt: null };

  it('accepts a Return Time between the Out Time and now', () => {
    expect(returnProblem(away, ist(3, 18, 30), NOW)).toBeNull();
  });

  it('refuses a Return Time later than now', () => {
    expect(returnProblem(away, NOW + 60_000, NOW)).toBe('return-time-in-future');
  });

  it('accepts a Return Time of exactly now', () => {
    expect(returnProblem(away, NOW, NOW)).toBeNull();
  });

  it('accepts a Return Time equal to the Out Time', () => {
    expect(returnProblem(away, away.outAt, NOW)).toBeNull();
  });

  it('refuses a Return Time earlier than the Out Time', () => {
    expect(returnProblem(away, ist(1, 7, 59), NOW)).toBe('return-before-out');
  });

  it('refuses a Return when he has no open Leave', () => {
    expect(returnProblem(null, ist(3, 18, 30), NOW)).toBe('no-open-leave');
  });

  it('accepts a Return later than the Expected Return', () => {
    const late = { ...away, expectedReturnAt: ist(2) };

    expect(returnProblem(late, ist(3, 18, 30), NOW)).toBeNull();
  });
});
