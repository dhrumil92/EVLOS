import { describe, expect, it } from 'vitest';
import { isInPoojaWindow, poojaWindowOf } from './pooja-window.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// An instant on 1 November 2026 at the given IST clock time.
const ist = (hour: number, minute: number, second: number) =>
  Date.UTC(2026, 10, 1, hour, minute, second) - IST_OFFSET_MS;

describe('Pooja Window', () => {
  it('counts a Punch at 05:30:00 IST, the first second of the window', () => {
    expect(isInPoojaWindow(ist(5, 30, 0))).toBe(true);
  });

  it('counts a Punch at 18:00:00 IST, the last second of the window', () => {
    expect(isInPoojaWindow(ist(18, 0, 0))).toBe(true);
  });

  it('counts a Punch in the middle of the window', () => {
    expect(isInPoojaWindow(ist(12, 0, 0))).toBe(true);
  });

  it('does not count a Punch at 05:29:59 IST, one second before the window', () => {
    expect(isInPoojaWindow(ist(5, 29, 59))).toBe(false);
  });

  it('does not count a Punch at 18:00:01 IST, one second after the window', () => {
    expect(isInPoojaWindow(ist(18, 0, 1))).toBe(false);
  });

  it('reads the window in IST, so 18:00:00 UTC (23:30 IST) does not count', () => {
    const eighteenHundredUtc = Date.UTC(2026, 10, 1, 18, 0, 0);

    expect(isInPoojaWindow(eighteenHundredUtc)).toBe(false);
  });

  it('reads the window in IST, so 00:00:00 UTC (05:30 IST) counts', () => {
    const midnightUtc = Date.UTC(2026, 10, 1, 0, 0, 0);

    expect(isInPoojaWindow(midnightUtc)).toBe(true);
  });

  it('opens at 05:30:00 IST on the given Day', () => {
    expect(poojaWindowOf('2026-11-01').opensAt).toBe(ist(5, 30, 0));
  });

  it('closes at 18:00:00 IST on the given Day', () => {
    expect(poojaWindowOf('2026-11-01').closesAt).toBe(ist(18, 0, 0));
  });
});
