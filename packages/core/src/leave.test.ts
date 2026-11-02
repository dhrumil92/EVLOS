import { describe, expect, it } from 'vitest';
import type { Clock, Instant } from './clock.js';
import { isAway, isDueBack } from './leave.js';
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
