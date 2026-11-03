import { describe, expect, it } from 'vitest';
import { canFinalize } from './finalize.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0, second = 0) =>
  Date.UTC(2026, 10, date, hour, minute, second) - IST_OFFSET_MS;

describe('canFinalize', () => {
  it('refuses while the Pooja Window is still open, at 18:00:00 exactly', () => {
    expect(canFinalize('2026-11-03', ist(3, 18, 0, 0))).toBe(false);
  });

  it('allows Finalize once the Pooja Window has closed', () => {
    expect(canFinalize('2026-11-03', ist(3, 18, 0, 1))).toBe(true);
  });

  it('refuses in the morning, before the window closes', () => {
    expect(canFinalize('2026-11-03', ist(3, 9))).toBe(false);
  });

  it('allows a past Day', () => {
    expect(canFinalize('2026-11-01', ist(3, 9))).toBe(true);
  });

  it('refuses a future Day', () => {
    expect(canFinalize('2026-11-04', ist(3, 23))).toBe(false);
  });
});
