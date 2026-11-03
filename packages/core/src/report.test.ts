import { describe, expect, it } from 'vitest';
import { hourSlotOf } from './report.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const at = (hour: number, minute = 0, second = 0) =>
  Date.UTC(2026, 10, 3, hour, minute, second) - IST_OFFSET_MS;

describe('hourSlotOf', () => {
  it.each([
    ['05:30:00, when the Pooja Window opens', at(5, 30), 0],
    ['06:29:59', at(6, 29, 59), 0],
    ['06:30:00', at(6, 30), 1],
    ['17:29:59', at(17, 29, 59), 11],
    ['17:30:00', at(17, 30), 12],
    ['18:00:00, when the Pooja Window closes', at(18, 0), 12],
  ])('puts a Punch at %s in its hour slot from 05:30', (_time, punchedAt, slot) => {
    expect(hourSlotOf(punchedAt)).toBe(slot);
  });

  it.each([
    ['05:29:59', at(5, 29, 59)],
    ['18:00:01', at(18, 0, 1)],
  ])('gives no slot to a Punch at %s, outside the Pooja Window', (_time, punchedAt) => {
    expect(hourSlotOf(punchedAt)).toBeNull();
  });
});
