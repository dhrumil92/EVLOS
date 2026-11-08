import { describe, expect, it } from 'vitest';
import { busiestSlot, firstPunchSlots, nowShare, SLOTS, slotWords } from './punch-band.js';
import type { LiveViewPunch } from './live-view-source.js';

const DAY = '2026-11-06';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const at = (hour: number, minute: number) => Date.UTC(2026, 10, 6, hour, minute) - IST_OFFSET_MS;

const punch = (studentId: string, punchedAt: number, isCounted = true): LiveViewPunch => ({
  studentId,
  name: `Student ${studentId}`,
  punchedAt,
  isCounted,
  notCountedBecause: isCounted ? null : 'outside-pooja-window',
});

describe('the Pooja Window band', () => {
  it('has one slot for every 15 minutes from 05:30 to 18:00', () => {
    expect(SLOTS).toBe(50);
    expect(slotWords(0)).toBe('05:30 to 05:45');
    expect(slotWords(49)).toBe('17:45 to 18:00');
  });

  it("counts each Student once, in the slot of the Student's first counted Punch", () => {
    const counts = firstPunchSlots(
      [
        punch('9001', at(6, 40)),
        punch('9001', at(6, 32)),
        punch('9002', at(6, 44)),
        punch('9003', at(7, 5)),
        punch('9004', at(5, 21), false),
      ],
      DAY,
    );

    expect(counts).toHaveLength(SLOTS);
    expect(counts[4]).toBe(2);
    expect(counts[6]).toBe(1);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it('puts a Punch at 18:00 exactly in the last slot, as the window includes both ends', () => {
    expect(firstPunchSlots([punch('9001', at(18, 0))], DAY)[49]).toBe(1);
  });

  it('names the busiest slot, or none on a Day with no counted Punch', () => {
    expect(busiestSlot([0, 3, 5, 2])).toBe(2);
    expect(busiestSlot([0, 0, 0])).toBeNull();
  });

  it('places Now inside the window on that Day only', () => {
    expect(nowShare(at(11, 45), DAY)).toBe(0.5);
    expect(nowShare(at(5, 0), DAY)).toBeNull();
    expect(nowShare(at(19, 0), DAY)).toBeNull();
    expect(nowShare(at(11, 45) + 24 * 60 * 60 * 1000, DAY)).toBeNull();
  });
});
