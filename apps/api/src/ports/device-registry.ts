import type { Instant } from '@evlos/core';

export interface DeviceRegistry {
  isRegistered(deviceSerial: string): Promise<boolean>;
  // Last Seen: remembers that a registered Device was in touch at this moment.
  markSeen(deviceSerial: string, at: Instant): Promise<void>;
  // The latest Last Seen of any registered Device; null when none has been in touch.
  lastSeen(): Promise<Instant | null>;
}
