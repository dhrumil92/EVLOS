import { fetchPage } from './auth-source.js';

// The Device's Last Seen, and whether it has gone quiet (10 minutes without a call).
export interface DeviceStatus {
  lastSeenAt: number | null;
  isQuiet: boolean;
}

export interface DeviceStatusSource {
  load(): Promise<DeviceStatus>;
}

export const httpDeviceStatusSource: DeviceStatusSource = {
  async load() {
    const reply = await fetchPage('/api/device-status');
    if (!reply.ok) throw new Error(`The server answered ${String(reply.status)}`);
    return (await reply.json()) as DeviceStatus;
  },
};
