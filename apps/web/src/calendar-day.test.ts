import { describe, expect, it } from 'vitest';
import { dayAfter, dayBefore } from './calendar-day.js';

describe('calendar Days', () => {
  it('the day before crosses a month end', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
  });

  it('the day after crosses a year end', () => {
    expect(dayAfter('2026-12-31')).toBe('2027-01-01');
  });
});
