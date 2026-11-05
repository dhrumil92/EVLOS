import { describe, expect, it } from 'vitest';
import { getDeviceStatus } from './device-status.js';

const MINUTE = 60 * 1000;
const LAST_SEEN = Date.UTC(2026, 10, 5, 17, 29, 0);

const devices = (lastSeen: number | null) => ({
  isRegistered: () => Promise.resolve(true),
  markSeen: () => Promise.resolve(),
  lastSeen: () => Promise.resolve(lastSeen),
});

describe('getDeviceStatus', () => {
  it('gives the Last Seen of a Device that was in touch a minute ago', async () => {
    const status = await getDeviceStatus({
      devices: devices(LAST_SEEN),
      clock: { now: () => LAST_SEEN + MINUTE },
    });

    expect(status).toEqual({ lastSeenAt: LAST_SEEN, isQuiet: false });
  });

  it('says the Device has gone quiet after 10 minutes without a call', async () => {
    const status = await getDeviceStatus({
      devices: devices(LAST_SEEN),
      clock: { now: () => LAST_SEEN + 10 * MINUTE },
    });

    expect(status).toEqual({ lastSeenAt: LAST_SEEN, isQuiet: true });
  });

  it('says the Device has gone quiet when it was never seen', async () => {
    const status = await getDeviceStatus({
      devices: devices(null),
      clock: { now: () => LAST_SEEN },
    });

    expect(status).toEqual({ lastSeenAt: null, isQuiet: true });
  });
});
