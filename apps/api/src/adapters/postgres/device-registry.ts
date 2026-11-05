import type { Instant } from '@evlos/core';
import { eq, max } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { devices } from '../../db/schema.js';
import type { DeviceRegistry } from '../../ports/device-registry.js';

export class PostgresDeviceRegistry implements DeviceRegistry {
  constructor(private readonly db: NodePgDatabase) {}

  async isRegistered(deviceSerial: string): Promise<boolean> {
    const found = await this.db
      .select({ deviceSerial: devices.deviceSerial })
      .from(devices)
      .where(eq(devices.deviceSerial, deviceSerial));
    return found.length > 0;
  }

  async markSeen(deviceSerial: string, at: Instant): Promise<void> {
    await this.db
      .update(devices)
      .set({ lastSeenAt: new Date(at) })
      .where(eq(devices.deviceSerial, deviceSerial));
  }

  async lastSeen(): Promise<Instant | null> {
    const [latest] = await this.db.select({ lastSeenAt: max(devices.lastSeenAt) }).from(devices);
    return latest?.lastSeenAt?.getTime() ?? null;
  }
}
