import { isDeviceQuiet } from '@evlos/core';
import type { Clock, Instant } from '@evlos/core';
import type { DeviceRegistry } from '../ports/device-registry.js';

// The Device's Last Seen, and whether it has gone quiet, so Punches may still be on it.
export interface DeviceStatus {
  lastSeenAt: Instant | null;
  isQuiet: boolean;
}

// Shown on the live view and before Finalize, so a Day is not Finalized while Punches are
// still waiting on a Device that is off its Wi-Fi.
export async function getDeviceStatus(deps: {
  devices: DeviceRegistry;
  clock: Clock;
}): Promise<DeviceStatus> {
  const lastSeenAt = await deps.devices.lastSeen();
  return { lastSeenAt, isQuiet: isDeviceQuiet(lastSeenAt, deps.clock.now()) };
}
