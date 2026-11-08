import { describe, expect, it } from 'vitest';
import type { Instant } from './clock.js';
import { POOJA_SLOTS, poojaSlotOf } from './pooja-window.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// An instant on 8 November 2026 at the given IST clock time.
const ist = (hour: number, minute: number, second = 0): Instant =>
  Date.UTC(2026, 10, 8, hour, minute, second) - IST_OFFSET_MS;

describe('the 15-minute bar of the Pooja Window a Punch falls in', () => {
  it('cuts the Pooja Window into 50 bars of 15 minutes', () => {
    expect(POOJA_SLOTS).toBe(50);
  });

  it('puts 05:30:00 IST, the first second of the window, in the first bar', () => {
    expect(poojaSlotOf(ist(5, 30))).toBe(0);
  });

  it('keeps 05:44:59 in the first bar and starts the second at 05:45:00', () => {
    expect(poojaSlotOf(ist(5, 44, 59))).toBe(0);
    expect(poojaSlotOf(ist(5, 45))).toBe(1);
  });

  it('puts 17:45 in the last bar', () => {
    expect(poojaSlotOf(ist(17, 45))).toBe(49);
  });

  it('puts 18:00:00 IST, the last second of the window, in the last bar too', () => {
    expect(poojaSlotOf(ist(18, 0))).toBe(49);
  });

  it('gives no bar to a Punch outside the Pooja Window', () => {
    expect(poojaSlotOf(ist(5, 29, 59))).toBeNull();
    expect(poojaSlotOf(ist(18, 0, 1))).toBeNull();
    expect(poojaSlotOf(ist(22, 0))).toBeNull();
  });

  it('works in IST, whatever the time in UTC', () => {
    // 07:00 IST is 01:30 UTC.
    expect(poojaSlotOf(Date.UTC(2026, 10, 8, 1, 30))).toBe(6);
  });
});
