import { describe, expect, it } from 'vitest';
import { isDeviceQuiet } from './device.js';

const MINUTE = 60 * 1000;
const LAST_SEEN = Date.UTC(2026, 10, 5, 17, 0, 0);

describe('Device Last Seen', () => {
  it('is not quiet just before 10 minutes have passed', () => {
    expect(isDeviceQuiet(LAST_SEEN, LAST_SEEN + 10 * MINUTE - 1)).toBe(false);
  });

  it('is quiet once 10 minutes have passed, so Punches may still be on the Device', () => {
    expect(isDeviceQuiet(LAST_SEEN, LAST_SEEN + 10 * MINUTE)).toBe(true);
  });

  it('is quiet when the Device has never been seen', () => {
    expect(isDeviceQuiet(null, LAST_SEEN)).toBe(true);
  });
});
